import {
  query,
  dynamoGetPineapple,
  dynamoUpdatePineapple,
  update,
  put,
  QueryCommandInput,
  UpdateCommandInput,
} from "./helper";
import { Mapping, QueryableAttributes } from "./mapping";
import { ulid } from "ulid";

class TableInterface {
  tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async addNewVersion(newItem: Record<string, any>) {
    // Prevents a stream loop!
    if (newItem.latestVersion === 0)
      return;
  
    const { createdAt, createdBy, latestVersion, entity, gsiSk1, ...newVersionItemAttributes } = newItem;
      
    newVersionItemAttributes.version = ulid();
    newVersionItemAttributes.sk = newVersionItemAttributes.sk.replace(/#version_0/, `#version_${newVersionItemAttributes.version}`);
    newVersionItemAttributes.sk = newVersionItemAttributes.sk.replace(entity, `${entity}Version`);
    newVersionItemAttributes.versionNumber = latestVersion;
  
    const params = {
      Item: {
        ...newVersionItemAttributes
      },
      TableName: this.tableName
    };
  
    return (await put(params)).item;
  }

  async listAllVersionsForEntity(
    entity: Record<string, any>,
    mappingClassInstance: Mapping,
    Limit?: number,
    exclusiveStartKey?: string | any
  ): Promise<iListAllVersionsForEntityResponse> {
    exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
    entity.version = "";
    let attachmentName;
    let encoder: Function;
    let decoder: Function;

    [entity, encoder, decoder, attachmentName] = initAttachmentMapping(
      entity,
      mappingClassInstance
    );

    const { pk, sk } = encoder(entity);

    let params: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
      Limit,
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#sk": "sk",
      },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":sk": sk.replace(mappingClassInstance.entityValues.entity, `${mappingClassInstance.entityValues.entity}Version`),
      },
    };

    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;

    const [res, latestVersion] = await Promise.all([
      query(params),
      this.getSpecificVersion(
        pk,
        `${sk}0`,
        decoder
      )
    ]);
    let versions = res.items;

    let response: iListAllVersionsForEntityResponse = { entity: latestVersion };
    if (res.lastEvaluatedKey)
      response.lastEvaluatedKey = encodeLastEvaluatedKey(res.lastEvaluatedKey);

    versions = versions.map((version: Record<string, any>) => {
      version = decoder(version);
      if (!version.entity)
        version.entity = mappingClassInstance.entityValues.entity;
      return version;
    });

    // Needed for attachments? If not, it can be removed
    if (!response.entity)
      response.entity = await this.getSpecificVersion(pk, `${sk}0`, decoder);

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
    entityPk: string,
    attachment: any,
    mappingClassInstance: Mapping,
    Limit: number,
    exclusiveStartKey: string | any,
    callback: (params: QueryCommandInput) => QueryCommandInput
  ): Promise<iListAttachmentsForEntityResponse> {
    const decoder =
      mappingClassInstance.decodeEntity.bind(mappingClassInstance);
    const attachmentEncoder =
      mappingClassInstance.encodeAttachment.bind(mappingClassInstance);
    const attachmentDecoder =
      mappingClassInstance.decodeAttachment.bind(mappingClassInstance);

    exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
    let entityFromDynamo = this.getDynamoRecord(
      decoder({ pk: entityPk, version: 0 }),
      mappingClassInstance
    );
    let attachmentName: string;

    [attachment, , , attachmentName] = initAttachmentMapping(
      { attachment },
      mappingClassInstance
    );
    attachment = attachmentEncoder(attachmentName)(attachment);

    let params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: "pk-gsiSk1",
      KeyConditionExpression: "#pk = :pk AND begins_with(#gsiSk1, :gsiSk1)",
      Limit,
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#gsiSk1": "gsiSk1",
      },
      ExpressionAttributeValues: {
        ":pk": entityPk,
        ":gsiSk1": attachment.attributes.gsiSk1,
      },
    };

    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;

    if (callback && typeof callback === "function") params = callback(params);

    const response = await query(params);

    response.items = response.items.map((item: any) => {
      return { attachmentName, ...attachmentDecoder(attachmentName)(item) };
    });

    return {
      entity: (await entityFromDynamo).entity,
      attachments: response.items,
      lastEvaluatedKey: encodeLastEvaluatedKey(response.lastEvaluatedKey),
    };
  }

  async getDynamoRecord(
    entity: Record<string, any>,
    mappingClassInstance: Mapping
  ): Promise<iGetDynamoRecordResponse> {
    let attachmentName: string;
    let encoder: Function;
    let decoder: Function;

    [entity, encoder, decoder, attachmentName] = initAttachmentMapping(
      entity,
      mappingClassInstance
    );

    let { pk, sk } = encoder(entity);

    if (entity.version !== 0)
      sk = sk.replace(mappingClassInstance.entityValues.entity, `${mappingClassInstance.entityValues.entity}Version`);

    const res = await dynamoGetPineapple(this.tableName, pk, sk);
    if (!res) return {};

    return {
      entity: attachmentName ? undefined : decoder(res),
      att: attachmentName ? decoder(res) : undefined,
    };
  }

  async updateDynamoRecord(
    entity: Record<string, any>,
    mappingClassInstance: Mapping,
    username: string,
    callback?: (params: UpdateCommandInput) => UpdateCommandInput,
    type = "entity"
  ): Promise<iUpdateDynamoRecordResponse> {
    let attachment;
    if (entity.attachment) {
      attachment = { ...entity.attachment };
      delete entity.attachment;
    }

    const encoder =
      type === "entity"
        ? mappingClassInstance.encodeEntity.bind(mappingClassInstance)
        : mappingClassInstance.encodeAttachment.bind(mappingClassInstance);
    const decoder =
      type === "entity"
        ? mappingClassInstance.decodeEntity.bind(mappingClassInstance)
        : mappingClassInstance.decodeAttachment.bind(mappingClassInstance);

    let {
      pk,
      sk,
      newItem,
      attributes,
      creationAttributes,
      gsiSk1Contains,
      gsiSk1Misses,
      sortKeyConstruction,
      usedMapping,
    } = encoder(entity as Record<string, any> & string) as any; // TODO: figure out if attachments still work here and get the typing right, because according to TypeScript this isn't possible
    if (type === "attachment")
      attributes = { ...attributes, ...creationAttributes };

    if (attachment) {
      const attachmentName = Object.keys(attachment)[0];
      attachment[attachmentName].pk = pk;
      attachment = this.updateDynamoRecord(
        attachment[attachmentName],
        mappingClassInstance,
        username,
        callback,
        "attachment"
      );
    }

    const entityShouldNotUpdate =
      !newItem &&
      Object.keys(attributes).length === 1 &&
      Object.keys(attributes)[0] === "gsiSk1";
    let decodedRecord: Record<string, any> | undefined;

    if (!entityShouldNotUpdate) {
      // We could eliminate this if we always enforce the presence of all gsiSk1 attributes in the joi schemas, but that might limit the freedom of the use of our APIs
      if (
        sortKeyConstruction &&
        sortKeyConstruction.gsiSk1 &&
        (!gsiSk1Contains ||
          gsiSk1Contains.length < sortKeyConstruction.gsiSk1.length)
      ) {
        let shouldGsiSk1BeUpdated;
        sortKeyConstruction.gsiSk1.forEach((key: string) => {
          const encodedKeyName = usedMapping[key] ?? key;
          if (attributes[encodedKeyName] || newItem)
            shouldGsiSk1BeUpdated = true;
        });

        if (!shouldGsiSk1BeUpdated) delete attributes.gsiSk1;
        else {
          if (!newItem) {
            // Get the missing data from DynamoDB in case of an update
            const entity = await dynamoGetPineapple(this.tableName, pk, sk);
            if (entity) {
              let stopGsiSk1Construction = false;
              gsiSk1Misses.forEach((missingKey: string) => {
                if (
                  !stopGsiSk1Construction &&
                  (entity[missingKey] || attributes[missingKey])
                )
                  attributes.gsiSk1 += attributes[missingKey]
                    ? attributes[missingKey] + "#"
                    : entity[missingKey] + "#";
                else stopGsiSk1Construction = true;
              });
            }
          }
          if (attributes.gsiSk1.charAt(attributes.gsiSk1.length - 1) === "#")
            attributes.gsiSk1 = attributes.gsiSk1.slice(0, -1);
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
          return getDecodedKeyFromAttribute(key, value, decoder);
        }
      );

      if (callback && typeof callback === "function") {
        // Do something extra with the params that is not included in the default dynamoUpdatePineapplePineapple before updating the DynamoDB record, such as appending a list
        params = callback(params);
      }

      try {
        decodedRecord = decoder((await update(params)).item);
      } catch (error: any) {
        console.error(
          "🚀 ~ file: tableInterface.js ~ line 151 ~ updateDynamoRecord ~ error",
          error
        );
        decodedRecord = error;
      }
    }

    let response: iUpdateDynamoRecordResponse = {};
    if (attachment) response.attachment = (await attachment).entity;
    if (!entityShouldNotUpdate) response.entity = decodedRecord;

    return response;
  }

  async listDynamoRecords(
    entity: Record<string, any>,
    mappingClassInstance: Mapping,
    Limit?: number,
    exclusiveStartKey?: string | any,
    callback?: (params: QueryCommandInput) => QueryCommandInput
  ): Promise<iListDynamoRecordsResponse> {
    exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
    let attachmentName: string;
    let encoder: Function;
    let decoder: Function;

    [entity, encoder, decoder, attachmentName] = initAttachmentMapping(
      entity,
      mappingClassInstance
    );

    let { pk, newItem, attributes, queryableAttributes, gsiSk1Contains } =
      encoder(entity);

    // If newItem is true it means there was no pk to query for, but one was generated automatically
    if (!newItem) attributes = { pk, ...attributes };

    const { keyName, indexName } = getKeyAndIndexToUse(
      attributes,
      queryableAttributes
    );

    let params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: indexName,
      Limit,
      ExpressionAttributeNames: {
        "#gsiSk1": "gsiSk1",
      },
      ExpressionAttributeValues: {
        ":gsiSk1": attributes["gsiSk1"].replace(/#$/, ""), // Trim # from string if it's the last character for better inclusion here
      },
    };

    const decodedKey = getDecodedKeyFromAttribute(keyName, "", decoder);

    if (params.ExpressionAttributeNames)
      params.ExpressionAttributeNames[`#${decodedKey}`] = keyName;
    if (params.ExpressionAttributeValues)
      params.ExpressionAttributeValues[`:${decodedKey}`] =
        keyName === "entity" ? entity.entity : attributes[keyName];

    params.KeyConditionExpression = `#${decodedKey} = :${decodedKey} AND begins_with(#gsiSk1, :gsiSk1)`;

    addFiltersToListParams(
      params,
      attributes,
      keyName,
      gsiSk1Contains,
      decoder
    );

    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;

    if (callback && typeof callback === "function") params = callback(params);

    const response = await query(params);

    response.items = await Promise.all(
      response.items.map(async (item: any) => {
        const decoded = { ...decoder(item) };
        if (attachmentName) {
          // We're getting the entity object belonging to this attachment as well, because our goal is to list entities that have a certain attachment
          const { entity } = await this.getDynamoRecord(
            decoder(item),
            mappingClassInstance
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

  async getSpecificVersion(
    pk: string,
    sk: string,
    decoder: Function,
  ): Promise<Record<string, any> | undefined> {
    if (!pk || !sk)
      return undefined;

    const version = await dynamoGetPineapple(this.tableName, pk, sk);
    if (!version)
      // Any custom error handling when the object does not exist can go here
      return undefined;

    return decoder(version);
  }
}

function getKeyAndIndexToUse(
  entityAttributes: any,
  queryableAttributes: Array<QueryableAttributes>
): { keyName: QueryableAttributes; indexName: string } {
  const entityAttributesArray = Object.keys(entityAttributes);

  for (let i = 0; i < queryableAttributes.length; i++) {
    const queryableKey = queryableAttributes[i];
    if (entityAttributesArray.includes(queryableKey))
      return { keyName: queryableKey, indexName: `${queryableKey}-gsiSk1` };
  }

  return { keyName: "entity", indexName: "entity-gsiSk1" };
}

function addFiltersToListParams(
  params: QueryCommandInput,
  attributes: any,
  keyName: string,
  gsiSk1Contains: Array<string>,
  decoder: Function
): void {
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === keyName || key === "gsiSk1" || gsiSk1Contains.includes(key))
      return;

    const decodedKey = getDecodedKeyFromAttribute(key, value, decoder);

    if (params.ExpressionAttributeNames)
      params.ExpressionAttributeNames[`#${decodedKey}`] = key;
    if (params.ExpressionAttributeValues)
      params.ExpressionAttributeValues[`:${decodedKey}`] = value;

    params.FilterExpression = params.FilterExpression
      ? `${params.FilterExpression} AND #${decodedKey} = :${decodedKey}`
      : `#${decodedKey} = :${decodedKey}`;
  });
}

function initAttachmentMapping(
  entity: Record<string, any>,
  mappingClassInstance: Mapping
): Array<any> {
  if (!entity.attachment)
    return [
      entity,
      mappingClassInstance.encodeEntity.bind(mappingClassInstance),
      mappingClassInstance.decodeEntity.bind(mappingClassInstance),
    ];

  const attachmentName = Object.keys(entity.attachment)[0];
  const encoder = mappingClassInstance
    .encodeAttachment(attachmentName)
    .bind(mappingClassInstance);
  const decoder = mappingClassInstance
    .decodeAttachment(attachmentName)
    .bind(mappingClassInstance);
  entity = Object.assign(entity, entity.attachment[attachmentName]);
  delete entity.attachment;

  return [entity, encoder, decoder, attachmentName];
}

function getDecodedKeyFromAttribute(
  key: string,
  value: any,
  decoder: Function
): string {
  let encodedObj: any = {};

  encodedObj[key] = value;
  const decodedObj = decoder(encodedObj);
  const decodedKeys = decodedObj ? Object.keys(decodedObj) : [];

  return decodedKeys && decodedKeys[0] ? decodedKeys[0] : key;
}

function encodeLastEvaluatedKey(lastEvaluatedKey: string | any): string {
  if (!lastEvaluatedKey || typeof lastEvaluatedKey === "string")
    return lastEvaluatedKey;

  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64");
}

function decodeExclusiveStartKey(exclusiveStartKey: string | any): any {
  if (!exclusiveStartKey || typeof exclusiveStartKey === "object")
    return exclusiveStartKey;

  return JSON.parse(Buffer.from(exclusiveStartKey, "base64").toString());
}

interface iGetDynamoRecordResponse {
  entity?: Record<string, any>;
  att?: Record<string, any>;
}
interface iListAllVersionsForEntityResponse {
  entity?: Record<string, any>;
  att?: Record<string, any>;
  lastEvaluatedKey?: string;
}

interface iUpdateDynamoRecordResponse {
  attachment?: Record<string, any>;
  entity?: Record<string, any>;
}

interface iListDynamoRecordsResponse {
  items: Array<Record<string, any>>;
  lastEvaluatedKey: string;
}

interface iListAttachmentsForEntityResponse {
  entity?: Record<string, any>;
  attachments: Array<Record<string, any>>;
  lastEvaluatedKey: string;
}

export {
  TableInterface,
  QueryCommandInput,
  UpdateCommandInput,
  iListAllVersionsForEntityResponse,
  iGetDynamoRecordResponse,
  iUpdateDynamoRecordResponse,
  iListDynamoRecordsResponse,
  iListAttachmentsForEntityResponse,
};
