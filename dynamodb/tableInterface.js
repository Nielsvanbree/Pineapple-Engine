const {
  query,
  dynamoGetPineapple,
  dynamoUpdatePineapple,
  update,
} = require("./helper");
const { compareVersions } = require("../helpers/utils");
const _ = require("lodash/fp/object");

class TableInterface {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async listAllVersionsForEntity(
    entity,
    encoder,
    decoder,
    attachmentEncoder,
    attachmentDecoder,
    Limit,
    exclusiveStartKey,
    versionsCallback
  ) {
    exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
    entity.version = "";
    let attachmentName;
    [entity, encoder, decoder, attachmentName] = initAttachmentMapping(
      entity,
      encoder,
      decoder,
      attachmentEncoder,
      attachmentDecoder
    );
  
    const { pk, sk } = encoder(entity);
  
    let params = {
      TableName: this.tableName,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
      Limit: exclusiveStartKey ? Limit : Limit + 1, // If there is no starting key, the latest version will be in this set, so to retrieve the amount of versions with this limit, we'll have to add 1
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#sk": "sk",
      },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":sk": sk,
      },
    };
  
    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;
  
    const [res, latestVersion, previousVersion] = await Promise.all([
      query(params),
      getSpecificVersion(pk, `${sk}0`, decoder, exclusiveStartKey, "latest"),
      getSpecificVersion(
        exclusiveStartKey ? exclusiveStartKey.pk : undefined,
        exclusiveStartKey ? exclusiveStartKey.sk : undefined,
        decoder
      ),
    ]);
    let versions = res.items;
  
    if (latestVersion) versions.unshift(latestVersion);
    if (previousVersion) versions.unshift(previousVersion);
  
    let response = {};
    if (res.lastEvaluatedKey)
      response.lastEvaluatedKey = encodeLastEvaluatedKey(res.lastEvaluatedKey);
  
    versions.map((v) => {
      v = decoder(v);
      if (v.version === 0) response.entity = v;
      if (!v.entity) v.entity = process.env.ENTITY_NAME;
      return v;
    });
  
    if (!response.entity)
      response.entity = await getSpecificVersion(pk, `${sk}0`, decoder);
  
    versions = versions.filter((v) => v.version !== 0);
  
    // The compareVersions compares values of a version with the previous version, which also sorts the array based on the version number
    // We have to leave out arrays inside arrays for now, because the object comparison function doesn't support it correctly yet!
    // If you want to omit this version comparison or if you need to make changes to it, use the versionsCallback
    if (versionsCallback) versions = versionsCallback(versions, compareVersions);
    else
      versions = compareVersions(versions, {}, [
        "createdAt",
        "createdBy",
        "updatedAt",
        "updatedBy",
        "version",
      ]);
  
    // We're only using the previous version for the comparison functionality, but it shouldn't be returned, because we already returned this version in the previous call
    if (previousVersion)
      versions = versions.filter((v) => v.version !== previousVersion.version);
  
    if (response.entity) response.entity.versions = versions;
    if (attachmentName)
      response = {
        att: response.entity,
        entity: undefined,
        lastEvaluatedKey: encodeLastEvaluatedKey(response.lastEvaluatedKey),
      };
  
    return response;
  }

  async listAttachmentsForEntity(
    entityPk,
    attachment,
    encoder,
    decoder,
    attachmentEncoder,
    attachmentDecoder,
    Limit,
    exclusiveStartKey,
    callback
  ) {
    exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
    let entityFromDynamo = getDynamoRecord(
      decoder({ pk: entityPk, v: 0 }),
      encoder,
      decoder
    );
    let attachmentName;
  
    [attachment, , , attachmentName] = initAttachmentMapping(
      { attachment },
      encoder,
      decoder,
      attachmentEncoder,
      attachmentDecoder
    );
    attachment = attachmentEncoder(attachmentName)(attachment);
  
    let params = {
      TableName: this.tableName,
      IndexName: "pk-esk",
      KeyConditionExpression: "#pk = :pk AND begins_with(#esk, :esk)",
      Limit,
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#esk": "esk",
      },
      ExpressionAttributeValues: {
        ":pk": entityPk,
        ":esk": attachment.attributes.esk,
      },
    };
  
    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;
  
    if (callback && typeof callback === "function") params = callback(params);
  
    const response = await query(params);
  
    response.items = response.items.map((item) => {
      return { attachmentName, ...attachmentDecoder(attachmentName)(item) };
    });
  
    return {
      entity: (await entityFromDynamo).entity,
      attachments: response.items,
      lastEvaluatedKey: encodeLastEvaluatedKey(response.lastEvaluatedKey),
    };
  }
  
  async getDynamoRecord(
    entity,
    encoder,
    decoder,
    attachmentEncoder,
    attachmentDecoder
  ) {
    let attachmentName;
    [entity, encoder, decoder, attachmentName] = initAttachmentMapping(
      entity,
      encoder,
      decoder,
      attachmentEncoder,
      attachmentDecoder
    );
  
    let { pk, sk } = encoder(entity);
    if (entity.v !== 0)
      sk = sk.replace(/#v\d+/, `#v${constructSkVersion(entity.v)}`);
  
    let res = await dynamoGetPineapple(this.tableName, pk, sk);
    if (!res) return {};
  
    return {
      entity: attachmentName ? undefined : decoder(res),
      att: attachmentName ? decoder(res) : undefined,
    };
  }
  
  async updateDynamoRecord(
    entity,
    encoder,
    decoder,
    attachmentEncoder,
    attachmentDecoder,
    username,
    callback,
    type = "entity"
  ) {
    let attachment;
    if (entity.attachment) {
      attachment = { ...entity.attachment };
      delete entity.attachment;
    }
  
    let {
      pk,
      sk,
      newItem,
      attributes,
      creationAttributes,
      eskContains,
      eskMisses,
      sortKeyConstruction,
      usedMapping,
    } = encoder(entity);
    if (type === "attachment")
      attributes = { ...attributes, ...creationAttributes };
  
    if (attachment) {
      const attachmentName = Object.keys(attachment)[0];
      attachment[attachmentName].pk = pk;
      attachment = updateDynamoRecord(
        attachment[attachmentName],
        attachmentEncoder(attachmentName),
        attachmentDecoder(attachmentName),
        undefined,
        undefined,
        username,
        callback,
        "attachment"
      );
    }
  
    const entityShouldNotUpdate =
      !newItem &&
      Object.keys(attributes).length === 1 &&
      Object.keys(attributes)[0] === "esk";
    let decodedRecord;
  
    if (!entityShouldNotUpdate) {
      // We could eliminate this if we always enforce the presence of all esk attributes in the joi schemas, but that might limit the freedom of the use of our APIs
      if (
        sortKeyConstruction &&
        sortKeyConstruction.esk &&
        (!eskContains || eskContains.length < sortKeyConstruction.esk.length)
      ) {
        let shouldEskBeUpdated;
        sortKeyConstruction.esk.forEach((key) => {
          const encodedKeyName = usedMapping[key];
          if (attributes[encodedKeyName] || newItem) shouldEskBeUpdated = true;
        });
  
        if (!shouldEskBeUpdated) delete attributes.esk;
        else {
          if (!newItem) {
            // Get the missing data from DynamoDB in case of an update
            const entity = await dynamoGetPineapple(this.tableName, pk, sk);
            if (entity) {
              let stopEskConstruction = false;
              eskMisses.forEach((missingKey) => {
                if (
                  !stopEskConstruction &&
                  (entity[missingKey] || attributes[missingKey])
                )
                  attributes.esk += attributes[missingKey]
                    ? attributes[missingKey] + "#"
                    : entity[missingKey] + "#";
                else stopEskConstruction = true;
              });
            }
          }
          if (attributes.esk.charAt(attributes.esk.length - 1) === "#")
            attributes.esk = attributes.esk.slice(0, -1);
        }
      }
  
      // We skip the same item check for attachments since there's no way of knowing up front if it exists or not
      const sameItemCheck = type === "entity" ? true : false;
  
      let params = await dynamoUpdatePineapple(
        this.tableName,
        pk,
        sk,
        newItem,
        username,
        attributes,
        creationAttributes,
        true,
        sameItemCheck,
        true,
        (key, value) => {
          // We get the attribute that will be added to the params object and turn the encoded key into a decoded key, because that will make the params object more readable for the backend engineer in case the callback is needed within the update API
          const usedDecoder = type === "entity" ? decoder : attachmentDecoder;
          return getDecodedKeyFromAttribute(key, value, usedDecoder);
        }
      );
  
      if (callback && typeof callback === "function") {
        // Do something extra with the params that is not included in the default dynamoUpdatePineapplePineapple before updating the DynamoDB record, such as appending a list
        params = callback(params);
      }
  
      try {
        decodedRecord = decoder((await update(params)).item);
      } catch (error) {
        console.error(
          "🚀 ~ file: tableInterface.js ~ line 151 ~ updateDynamoRecord ~ error",
          error
        );
        decodedRecord = error;
      }
    }
  
    let response = {};
    if (attachment) response.attachment = (await attachment).entity;
    if (!entityShouldNotUpdate) response.entity = decodedRecord;
  
    return response;
  }
  
  async listDynamoRecords(
    entity,
    encoder,
    decoder,
    attachmentEncoder,
    attachmentDecoder,
    Limit,
    exclusiveStartKey,
    callback
  ) {
    exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
    let attachmentName,
      entityEncoder = encoder,
      entityDecoder = decoder;
    [entity, encoder, decoder, attachmentName] = initAttachmentMapping(
      entity,
      encoder,
      decoder,
      attachmentEncoder,
      attachmentDecoder
    );
  
    let { pk, newItem, attributes, queryableAttributes, eskContains } =
      encoder(entity);
  
    // If newItem is true it means there was no pk to query for, but one was generated automatically
    if (!newItem) attributes = { pk, ...attributes };
  
    const { keyName, indexName } = getKeyAndIndexToUse(
      attributes,
      queryableAttributes
    );
  
    let params = {
      TableName: this.tableName,
      IndexName: indexName,
      Limit,
      ExpressionAttributeNames: {
        "#esk": "esk",
      },
      ExpressionAttributeValues: {
        ":esk": attributes["esk"].replace(/#$/, ""), // Trim # from string if it's the last character for better inclusion here
      },
    };
  
    const decodedKey = getDecodedKeyFromAttribute(keyName, "", decoder);
    params.ExpressionAttributeNames[`#${decodedKey}`] = keyName;
    params.ExpressionAttributeValues[`:${decodedKey}`] =
      keyName === "e" ? entity.e : attributes[keyName];
    params.KeyConditionExpression = `#${decodedKey} = :${decodedKey} AND begins_with(#esk, :esk)`;
  
    addFiltersToListParams(params, attributes, keyName, eskContains, decoder);
  
    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;
  
    if (callback && typeof callback === "function") params = callback(params);
  
    const response = await query(params);
  
    response.items = await Promise.all(
      response.items.map(async (item) => {
        const decoded = { ...decoder(item) };
        if (attachmentName) {
          // We're getting the entity object belonging to this attachment as well, because our goal is to list entities that have a certain attachment
          const { entity } = await getDynamoRecord(
            decoder(item),
            entityEncoder,
            entityDecoder
          );
          return { entity, attachment: decoded };
        }
        return { entity: decoded };
      })
    );
  
    return {
      items: response.items,
      lastEvaluatedKey: encodeLastEvaluatedKey(response.lastEvaluatedKey),
    };
  }

  // We prefix the version with 0's in order for the version to be able to be queried in the correct sorting order
  constructSkVersion(v) {
    // A length of 6 gives us up to a million versions for the same object
    const skVersionLength = 6;
    const versionLength = v.toString().length;
    let skVersion = "";

    for (let i = 0; i < skVersionLength - versionLength; i++) {
      skVersion += "0";
    }

    return (skVersion += v.toString());
  }

}

async function getSpecificVersion(pk, sk, decoder, exclusiveStartKey, type) {
  exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
  if (!pk || !sk || (type === "latest" && !exclusiveStartKey)) return undefined;

  const version = await dynamoGetPineapple(this.tableName, pk, sk);
  if (!version)
    // Any custom error handling when the object does not exist can go here
    return undefined;

  return decoder(version);
}

function getKeyAndIndexToUse(entityAttributes, queryableAttributes) {
  const entityAttributesArray = Object.keys(entityAttributes);

  for (let i = 0; i < queryableAttributes.length; i++) {
    const queryableKey = queryableAttributes[i];
    if (entityAttributesArray.includes(queryableKey))
      return { keyName: queryableKey, indexName: `${queryableKey}-esk` };
  }

  return { keyName: "e", indexName: "e-esk" };
}

function addFiltersToListParams(
  params,
  attributes,
  keyName,
  eskContains,
  decoder
) {
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === keyName || key === "esk" || eskContains.includes(key)) return;

    const decodedKey = getDecodedKeyFromAttribute(key, value, decoder);

    params.ExpressionAttributeNames[`#${decodedKey}`] = key;
    params.ExpressionAttributeValues[`:${decodedKey}`] = value;
    params.FilterExpression = params.FilterExpression
      ? `${params.FilterExpression} AND #${decodedKey} = :${decodedKey}`
      : `#${decodedKey} = :${decodedKey}`;
  });
}

function initAttachmentMapping(
  entity,
  encoder,
  decoder,
  attachmentEncoder,
  attachmentDecoder
) {
  if (!entity.attachment) return [entity, encoder, decoder];

  const attachmentName = Object.keys(entity.attachment)[0];
  encoder = attachmentEncoder(attachmentName);
  decoder = attachmentDecoder(attachmentName);
  entity = _.merge(entity, entity.attachment[attachmentName]);
  delete entity.attachment;

  return [entity, encoder, decoder, attachmentName];
}

function getDecodedKeyFromAttribute(key, value, decoder) {
  let encodedObj = {},
    decodedObj;
  encodedObj[key] = value;
  decodedObj = decoder(encodedObj);
  const decodedKeys = decodedObj ? Object.keys(decodedObj) : [];
  return decodedKeys && decodedKeys[0] ? decodedKeys[0] : key;
}

function encodeLastEvaluatedKey(lastEvaluatedKey) {
  if (!lastEvaluatedKey || typeof lastEvaluatedKey === "string")
    return lastEvaluatedKey;

  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64");
}

function decodeExclusiveStartKey(exclusiveStartKey) {
  if (!exclusiveStartKey || typeof exclusiveStartKey === "object")
    return exclusiveStartKey;

  return JSON.parse(Buffer.from(exclusiveStartKey, "base64").toString());
}

module.exports = TableInterface;
