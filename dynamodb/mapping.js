const { v4: uuidv4 } = require("uuid");

class Mapping {
  constructor(entityName, mappingConfig) {
    this.entityValues = { entity: entityName };
    this.mappingConfig = mappingConfig;
  }

  encodeEntity(entity) {
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

  decodeEntity(entity) {
    return decode(entity, this.mappingConfig.encodedToDecodedMapping);
  }

  encodeAttachment(attachmentName) {
    return (attachment) => {
      const {
        entity,
        sortKeyConstruction,
        encodedToDecodedMapping,
        queryableAttributesForAttachment,
      } = getAttachmentMapping(attachmentName, this.mapping.attachmentsMapping);
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

  decodeAttachment(attachmentName) {
    return (attachment) => {
      const { encodedToDecodedMapping } = getAttachmentMapping(
        attachmentName,
        this.mapping.attachmentsMapping
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
  const { eskContains, eskMisses } = addSortKeysToEntity({
    entity,
    sortKeyConstruction,
    usedMapping,
  });

  return prepEncodedEntityResponse({
    entity,
    eskContains,
    eskMisses,
    sortKeyConstruction,
    queryableAttributesFromEntity,
    usedMapping,
  });
}

function decode(entity, entitySpecificMapping) {
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

function getAttachmentMapping(attachmentName, attachmentsMapping) {
  if (!attachmentsMapping[attachmentName])
    throw {
      statusCode: 404,
      code: "ResourceNotFoundException",
      message: `No attachment with the name ${attachmentName} found`,
    };

  return attachmentsMapping[attachmentName];
}

function getReversedMapping(mappingToReverse) {
  const reversedMapping = {};

  Object.entries(mappingToReverse).forEach(([key, value]) => {
    reversedMapping[value] = key;
  });

  return reversedMapping;
}

function encodeEntityAttributes(entity, usedMapping) {
  Object.entries(entity).map(([key, value]) => {
    if (usedMapping[key]) {
      entity[usedMapping[key]] = value;
      delete entity[key];
    }
  });

  return entity;
}

function decodeEntityAttributes(entity, usedMapping) {
  Object.entries(entity).map(([key, value]) => {
    if (usedMapping[key]) {
      entity[usedMapping[key]] = value;
      delete entity[key];
    }
  });

  // These values should never be necessary to work with in your code, so we can leave them out when decoding
  if (entity.sk) delete entity.sk;
  if (entity.esk) delete entity.esk;
  if (entity.entity) delete entity.entity;

  return entity;
}

function addSortKeysToEntity({ entity, sortKeyConstruction, usedMapping }) {
  let eskContains = [],
    eskMisses = [];
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
        encodedKeyName === "v"
          ? `v${entity[encodedKeyName]}`
          : entity[encodedKeyName];

      if (key === "esk") eskContains.push(encodedKeyName);
    }

    entity[key] = value;
  });

  if (
    sortKeyConstruction.esk &&
    sortKeyConstruction.esk.length !== eskContains.length
  ) {
    sortKeyConstruction.esk.forEach((key) => {
      const encodedKeyName = usedMapping[key] || key;
      if (!eskContains.includes(encodedKeyName)) eskMisses.push(encodedKeyName);
    });
  }

  return { entity, eskContains, eskMisses };
}

function prepEncodedEntityResponse({
  entity,
  eskContains,
  eskMisses,
  sortKeyConstruction,
  queryableAttributesFromEntity,
  usedMapping,
}) {
  const newItem = entity.pk ? false : true;

  const response = {
    pk: `${newItem ? `${entity.e}_${uuidv4()}` : entity.pk}`,
    sk: entity.sk,
    newItem,
    attributes: {},
    creationAttributes: {},
    queryableAttributes: queryableAttributesFromEntity || QUERYABLE_ATTRIBUTES,
    eskContains,
    eskMisses,
    sortKeyConstruction,
    usedMapping,
  };

  delete entity.pk;
  delete entity.sk;

  Object.entries(entity).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (CREATION_ATTRIBUTES.includes(key))
        response.creationAttributes[key] = value;
      else if (!KEY_ATTRIBUTES.includes(key)) response.attributes[key] = value;
    }
  });

  return response;
}

const GLOBAL_ENCODED_TO_DECODED_MAPPING = {
  e: "entity",
  t: "type",
  s: "status",
  r: "role",
  v: "version",
  lv: "latestVersion",
  ca: "createdAt",
  cb: "createdBy",
  ua: "updatedAt",
  ub: "updatedBy",
};

// These attributes are only created, never updated
const CREATION_ATTRIBUTES = ["v", "e", "ca", "cb"];

// Key attributes of the base table
const KEY_ATTRIBUTES = ["pk", "sk"];

// Attributes that can be used to query with
// The order of the array determines the priority of the attribute when listing
const QUERYABLE_ATTRIBUTES = ["pk", "eid1", "eid2", "e"];

module.exports = Mapping;
