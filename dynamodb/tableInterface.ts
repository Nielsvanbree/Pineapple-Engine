import {
  query,
  dynamoGetPineapple,
  dynamoUpdatePineapple,
  update,
  put,
  get,
  QueryCommandInput,
  UpdateCommandInput,
  GetCommandInput,
} from "../helpers/dynamodb";
import { Mapping, QueryableAttributes } from "./mapping";
import { ulid } from "ulid";

class TableInterface {
  tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async addNewVersion(newItem: Record<string, any>) {
    // Prevents a stream loop!
    if (newItem.latestVersion === 0) return;

    const {
      createdAt,
      createdBy,
      latestVersion,
      entity,
      gsiSk1,
      ...newVersionItemAttributes
    } = newItem;

    newVersionItemAttributes.version = ulid();
    newVersionItemAttributes.sk = newVersionItemAttributes.sk.replace(
      /#version_0/,
      `#version_${newVersionItemAttributes.version}`
    );
    newVersionItemAttributes.sk = newVersionItemAttributes.sk.replace(
      entity,
      `${entity}Version`
    );
    newVersionItemAttributes.versionNumber = latestVersion;

    const params = {
      Item: {
        ...newVersionItemAttributes,
      },
      TableName: this.tableName,
    };

    return (await put(params)).item;
  }

  async listAllVersionsForEntity(
    entity: Record<string, any>,
    mappingClassInstance: Mapping,
    Limit?: number,
    exclusiveStartKey?: string | any,
    callback?: (
      versionParams: QueryCommandInput,
      latestVersionParams: GetCommandInput
    ) => {
      versionParams: QueryCommandInput;
      latestVersionParams: GetCommandInput;
    },
    paramsOnly?: boolean
  ): Promise<iListAllVersionsForEntityResponse> {
    exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
    entity.version = "";
    const encoder: Function =
      mappingClassInstance.encodeEntity.bind(mappingClassInstance);
    const decoder: Function =
      mappingClassInstance.decodeEntity.bind(mappingClassInstance);

    const { pk, sk } = encoder(entity);

    let latestVersionParamsObject = (await this.getSpecificVersion(
      pk,
      `${sk}0`,
      decoder,
      true
    )) as GetCommandInput;

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
        ":sk": sk.replace(
          mappingClassInstance.entityValues.entity,
          `${mappingClassInstance.entityValues.entity}Version`
        ),
      },
    };

    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;

    if (callback && typeof callback === "function") {
      const { versionParams, latestVersionParams } = callback(
        params,
        latestVersionParamsObject
      );

      params = versionParams;
      latestVersionParamsObject = latestVersionParams;
    }

    if (paramsOnly)
      return {
        versionParams: {
          versions: params,
          latestVersion: latestVersionParamsObject,
        },
      };

    const [{ items, lastEvaluatedKey }, { item: latestVersion }] =
      await Promise.all([query(params), get(latestVersionParamsObject)]);

    const response: iListAllVersionsForEntityResponse = {
      entity: decoder(latestVersion),
    };
    if (lastEvaluatedKey)
      response.lastEvaluatedKey = encodeLastEvaluatedKey(lastEvaluatedKey);

    const versions = items.map((version: Record<string, any>) => {
      version = decoder(version);

      if (!version.entity)
        version.entity = mappingClassInstance.entityValues.entity;

      return version;
    });

    if (response.entity) response.entity.versions = versions;

    return response;
  }

  async getDynamoRecord(
    entity: Record<string, any>,
    mappingClassInstance: Mapping,
    callback?: (params: GetCommandInput) => GetCommandInput,
    paramsOnly?: boolean
  ): Promise<iGetDynamoRecordResponse> {
    const encoder: Function =
      mappingClassInstance.encodeEntity.bind(mappingClassInstance);
    const decoder: Function =
      mappingClassInstance.decodeEntity.bind(mappingClassInstance);

    let { pk, sk } = encoder(entity);

    if (entity.version !== 0)
      sk = sk.replace(
        mappingClassInstance.entityValues.entity,
        `${mappingClassInstance.entityValues.entity}Version`
      );

    let params = (await dynamoGetPineapple(
      this.tableName,
      pk,
      sk,
      true
    )) as GetCommandInput;

    if (callback && typeof callback === "function") params = callback(params);

    if (paramsOnly) return { params };

    const { item } = await get(params);

    if (!item) return {};

    return {
      entity: decoder(item),
    };
  }

  async updateDynamoRecord(
    entity: Record<string, any>,
    mappingClassInstance: Mapping,
    username: string,
    paramsOnly?: boolean,
    callback?: (params: UpdateCommandInput) => UpdateCommandInput
  ): Promise<iUpdateDynamoRecordResponse> {
    const encoder =
      mappingClassInstance.encodeEntity.bind(mappingClassInstance);
    const decoder =
      mappingClassInstance.decodeEntity.bind(mappingClassInstance);

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
    } = encoder(entity, username);

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
          let stopGsiSk1Construction = false;

          if (!newItem) {
            // Get the missing data from DynamoDB in case of an update
            const entity = (await dynamoGetPineapple(
              this.tableName,
              pk,
              sk
            )) as Record<string, any>;

            if (entity) {
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

          if (
            attributes.gsiSk1.charAt(attributes.gsiSk1.length - 1) === "#" &&
            ((!newItem && !stopGsiSk1Construction) ||
              (newItem && gsiSk1Misses?.length === 0))
          )
            attributes.gsiSk1 = attributes.gsiSk1.slice(0, -1);
        }
      }

      let params = await dynamoUpdatePineapple({
        TableName: this.tableName,
        pk,
        sk,
        newItem,
        attributes,
        createdAttributes: creationAttributes,
        returnParams: true,
        newItemCheck: true,
        attributeCallback: (key, value) => {
          // We get the attribute that will be added to the params object and turn the encoded key into a decoded key, because that will make the params object more readable for the backend engineer in case the callback is needed within the update API
          return getDecodedKeyFromAttribute(key, value, decoder);
        },
      });

      if (callback && typeof callback === "function") {
        // Do something extra with the params that is not included in the default dynamoUpdatePineapplePineapple before updating the DynamoDB record, such as appending a list
        params = callback(params);
      }

      if (paramsOnly) return { params };

      decodedRecord = decoder((await update(params)).item);
    }

    const response: iUpdateDynamoRecordResponse = {};
    if (!entityShouldNotUpdate) response.entity = decodedRecord;

    return response;
  }

  async listDynamoRecords(
    entity: Record<string, any>,
    mappingClassInstance: Mapping,
    Limit?: number,
    exclusiveStartKey?: string | any,
    attachmentIdKeyName?: string | undefined,
    callback?: (params: QueryCommandInput) => QueryCommandInput,
    paramsOnly?: boolean
  ): Promise<iListDynamoRecordsResponse> {
    exclusiveStartKey = decodeExclusiveStartKey(exclusiveStartKey);
    const encoder: Function =
      mappingClassInstance.encodeEntity.bind(mappingClassInstance);
    const decoder: Function =
      mappingClassInstance.decodeEntity.bind(mappingClassInstance);

    const attachmentIdKeyNamePresent =
      attachmentIdKeyName && entity[attachmentIdKeyName] ? true : false;

    let { pk, newItem, attributes, queryableAttributes, gsiSk1Contains } =
      encoder(entity);

    // If newItem is true it means there was no pk to query for, but one was generated automatically
    if (!newItem && pk !== "undefined") attributes = { pk, ...attributes };
    if (attachmentIdKeyName && !attachmentIdKeyNamePresent)
      delete attributes[attachmentIdKeyName];
    if (attachmentIdKeyName && pk && pk !== "undefined") attributes.pk = pk;

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
        ":gsiSk1": attributes["gsiSk1"],
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
      decoder,
      attachmentIdKeyNamePresent, 
      attachmentIdKeyName
    );

    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;

    if (callback && typeof callback === "function") params = callback(params);

    if (paramsOnly) return { params };

    const response = await query(params);

    response.items = response.items.map((item: any) => {
      const decoded = { ...decoder(item) };

      return { entity: decoded };
    });

    return {
      items: response.items,
      lastEvaluatedKey: encodeLastEvaluatedKey(response.lastEvaluatedKey),
    };
  }

  async getSpecificVersion(
    pk: string,
    sk: string,
    decoder: Function,
    paramsOnly?: boolean
  ): Promise<Record<string, any> | undefined | GetCommandInput> {
    if (!pk || !sk) return undefined;

    const version = await dynamoGetPineapple(
      this.tableName,
      pk,
      sk,
      paramsOnly
    );
    if (!version)
      // Any custom error handling when the object does not exist can go here
      return undefined;

    return paramsOnly ? version : decoder(version);
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
  decoder: Function,
  attachmentIdKeyNamePresent?: boolean,
  attachmentIdKeyName?: string
): void {
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === keyName || key === "gsiSk1" || gsiSk1Contains.includes(key))
      return;

    const decodedKey = getDecodedKeyFromAttribute(key, value, decoder);

    if (attachmentIdKeyName && !attachmentIdKeyNamePresent && decodedKey === attachmentIdKeyName)
      return;

    if (params.ExpressionAttributeNames)
      params.ExpressionAttributeNames[`#${decodedKey}`] = key;
    if (params.ExpressionAttributeValues)
      params.ExpressionAttributeValues[`:${decodedKey}`] = value;

    params.FilterExpression = params.FilterExpression
      ? `${params.FilterExpression} AND #${decodedKey} = :${decodedKey}`
      : `#${decodedKey} = :${decodedKey}`;
  });
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
  params?: GetCommandInput;
}
interface iListAllVersionsForEntityResponse {
  entity?: Record<string, any>;
  lastEvaluatedKey?: string;
  versionParams?: {
    versions?: QueryCommandInput;
    latestVersion?: GetCommandInput;
  };
}

interface iUpdateDynamoRecordResponse {
  entity?: Record<string, any>;
  params?: UpdateCommandInput;
}

interface iListDynamoRecordsResponse {
  items?: Array<Record<string, any>>;
  lastEvaluatedKey?: string;
  params?: QueryCommandInput;
}

export {
  TableInterface,
  QueryCommandInput,
  UpdateCommandInput,
  GetCommandInput,
  iListAllVersionsForEntityResponse,
  iGetDynamoRecordResponse,
  iUpdateDynamoRecordResponse,
  iListDynamoRecordsResponse,
};
