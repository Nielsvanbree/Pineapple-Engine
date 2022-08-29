import { v4 as uuidv4 } from "uuid";

class Mapping {
  entityValues: { entity: string };
  mappingConfig: iMappingConfig;

  constructor(entityName: string, mappingConfig: iMappingConfig) {
    this.entityValues = { entity: entityName };
    this.mappingConfig = mappingConfig;
  }

  encodeEntity(entity: any) {
    if (!entity || typeof entity !== "object")
      throw {
        statusCode: 400,
        code: "InvalidParameterException",
        message: "Malformed entity object",
      };

    if (!entity.entity) entity.entity = this.entityValues.entity;
    if (entity.version === undefined || entity.version === null)
      entity.version = 0;

    const decodedToEncodedMapping = getReversedMapping(
      this.mappingConfig.encodedToDecodedMapping
    );

    return encode({
      entity,
      entitySpecificMapping: decodedToEncodedMapping,
      sortKeyConstruction: this.mappingConfig.sortKeyConstruction,
      queryableAttributesFromEntity: this.mappingConfig.queryableAttributes,
    });
  }

  decodeEntity(entity: any) {
    return decode(entity, this.mappingConfig.encodedToDecodedMapping);
  }

  encodeAttachment(attachmentName: string) {
    return (attachment: any) => {
      const {
        entity,
        sortKeyConstruction,
        encodedToDecodedMapping,
        queryableAttributesForAttachment,
      } = getAttachmentMapping(attachmentName, this.mappingConfig.attachmentsMapping);
      const decodedToEncodedMapping = getReversedMapping(
        encodedToDecodedMapping
      );

      attachment.entity = `${this.entityValues.entity}_${entity}`;
      if (attachment.version === undefined || attachment.version === null)
        attachment.version = 0;

      return encode({
        entity: attachment,
        entitySpecificMapping: decodedToEncodedMapping,
        sortKeyConstruction,
        queryableAttributesFromEntity: queryableAttributesForAttachment,
      });
    };
  }

  decodeAttachment(attachmentName: string) {
    return (attachment: any) => {
      const { encodedToDecodedMapping } = getAttachmentMapping(
        attachmentName,
        this.mappingConfig.attachmentsMapping
      );

      return decode(attachment, encodedToDecodedMapping);
    };
  }
}

function encode({
  entity,
  entitySpecificMapping,
  sortKeyConstruction,
  queryableAttributesFromEntity,
}: {
  entity: any,
  entitySpecificMapping: any,
  sortKeyConstruction: iSortKeyConstruction,
  queryableAttributesFromEntity: iQueryableAttributes
}) {
  if (!entity || typeof entity !== "object")
    throw {
      statusCode: 400,
      code: "InvalidParameterException",
      message: "Malformed entity object",
    };

  const usedMapping = {
    ...getReversedMapping(GLOBAL_ENCODED_TO_DECODED_MAPPING),
    ...entitySpecificMapping,
  };

  encodeEntityAttributes(entity, usedMapping);
  const { gsiSk1Contains, gsiSk1Misses } = addSortKeysToEntity({
    entity,
    sortKeyConstruction,
    usedMapping,
  });

  return prepEncodedEntityResponse({
    entity,
    gsiSk1Contains,
    gsiSk1Misses,
    sortKeyConstruction,
    queryableAttributesFromEntity,
    usedMapping,
  });
}

function decode(entity: any, entitySpecificMapping: iEncodedToDecodedMapping) {
  if (!entity || typeof entity !== "object")
    throw {
      statusCode: 400,
      code: "InvalidParameterException",
      message: "Malformed entity object",
    };

  const usedMapping = {
    ...GLOBAL_ENCODED_TO_DECODED_MAPPING,
    ...entitySpecificMapping,
  };

  return decodeEntityAttributes(entity, usedMapping);
}

function getAttachmentMapping(attachmentName: string, attachmentsMapping: any) {
  if (!attachmentsMapping[attachmentName])
    throw {
      statusCode: 404,
      code: "ResourceNotFoundException",
      message: `No attachment with the name ${attachmentName} found`,
    };

  return attachmentsMapping[attachmentName];
}

function getReversedMapping(mappingToReverse: iEncodedToDecodedMapping) {
  const reversedMapping: any = {};

  Object.entries(mappingToReverse).forEach(([key, value]: [string, any]) => {
    reversedMapping[value] = key;
  });

  return reversedMapping;
}

function encodeEntityAttributes(entity: any, usedMapping: any) {
  Object.entries(entity).map(([key, value]: [string, any]) => {
    if (usedMapping[key]) {
      entity[usedMapping[key]] = value;
      delete entity[key];
    }
  });

  return entity;
}

function decodeEntityAttributes(entity: any, usedMapping: any) {
  Object.entries(entity).map(([key, value]) => {
    if (usedMapping[key]) {
      entity[usedMapping[key]] = value;
      delete entity[key];
    }
  });

  // These values should never be necessary to work with in your code, so we can leave them out when decoding
  if (entity.sk) delete entity.sk;
  if (entity.gsiSk1) delete entity.gsiSk1;
  if (entity.entity) delete entity.entity;

  return entity;
}

function addSortKeysToEntity({ entity, sortKeyConstruction, usedMapping }: { entity: any, sortKeyConstruction: iSortKeyConstruction, usedMapping: any }) {
  let gsiSk1Contains: Array<string> = [];
  let gsiSk1Misses: Array<string> = [];

  Object.entries(sortKeyConstruction).forEach(([key, constructionArray]) => {
    let value = "";

    for (let i = 0; i < constructionArray.length; i++) {
      const encodedKeyName = usedMapping[constructionArray[i]] || constructionArray[i];

      if (i !== 0) value += "#";
      if (
        entity[encodedKeyName] === undefined ||
        entity[encodedKeyName] === null
      )
        break;

      value +=
        encodedKeyName === "version"
          ? `v${entity[encodedKeyName]}`
          : entity[encodedKeyName];

      if (key === "gsiSk1") gsiSk1Contains.push(encodedKeyName);
    }

    entity[key] = value;
  });

  if (
    sortKeyConstruction.gsiSk1 &&
    sortKeyConstruction.gsiSk1.length !== gsiSk1Contains.length
  ) {
    sortKeyConstruction.gsiSk1.forEach((key) => {
      const encodedKeyName = usedMapping[key] || key;
      if (!gsiSk1Contains.includes(encodedKeyName)) gsiSk1Misses.push(encodedKeyName);
    });
  }

  return { entity, gsiSk1Contains, gsiSk1Misses };
}

function prepEncodedEntityResponse({
  entity,
  gsiSk1Contains,
  gsiSk1Misses,
  sortKeyConstruction,
  queryableAttributesFromEntity,
  usedMapping,
}: {
  entity: any,
  gsiSk1Contains: Array<string>,
  gsiSk1Misses: Array<string>,
  sortKeyConstruction: iSortKeyConstruction,
  queryableAttributesFromEntity: iQueryableAttributes,
  usedMapping: any
}) {
  const newItem = entity.pk ? false : true;

  const response: any = {
    pk: `${newItem ? `${entity.entity}_${uuidv4()}` : entity.pk}`,
    sk: entity.sk,
    newItem,
    attributes: {},
    creationAttributes: {},
    queryableAttributes: queryableAttributesFromEntity || QUERYABLE_ATTRIBUTES,
    gsiSk1Contains,
    gsiSk1Misses,
    sortKeyConstruction,
    usedMapping,
  };

  delete entity.pk;
  delete entity.sk;

  Object.entries(entity).forEach(([key, value]: [string, any]) => {
    if (value !== null && value !== undefined) {
      if (CREATION_ATTRIBUTES.includes(key))
        response.creationAttributes[key] = value;
      else if (!KEY_ATTRIBUTES.includes(key)) response.attributes[key] = value;
    }
  });

  return response;
}

// Optionally add attributes names that should always be mapped to another name, such as v for version
const GLOBAL_ENCODED_TO_DECODED_MAPPING: any = {};

// These attributes are only created, never updated
const CREATION_ATTRIBUTES: iCreationAttributes = ["version", "entity", "createdAt", "createdBy"];

// Key attributes of the base table
const KEY_ATTRIBUTES: iKeyAttributes = ["pk", "sk"]; 

// Attributes that can be used to query with
// The order of the array determines the priority of the attribute when listing
const QUERYABLE_ATTRIBUTES: iQueryableAttributes = ["pk", "gsiPk1", "gsiPk2", "entity"];


// Types and interfaces

type iQueryableAttributes = Array<"pk" | "gsiPk1" | "gsiPk2" | "gsiPk3" | "entity">;
type iCreationAttributes = ["version" | string, "entity" | string, "createdAt" | string, "createdBy" | string];
type iKeyAttributes = ["pk" | string, "sk" | string];

interface iSortKeyConstruction {
  sk: Array<string>;
  gsiSk1?: Array<string>;
}
interface iEncodedToDecodedMapping {
  pk: string;
  gsiPk1?: string;
  gsiPk2?: string;
  gsiPk3?: string;
};
interface iMappingConfig {
  encodedToDecodedMapping: iEncodedToDecodedMapping;
  sortKeyConstruction: iSortKeyConstruction;
  queryableAttributes: iQueryableAttributes;
  attachmentsMapping: any;
}

export { Mapping, iMappingConfig, iQueryableAttributes };
