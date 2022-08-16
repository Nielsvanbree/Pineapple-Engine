const {
  encodeEntity,
  decodeEntity,
} = require('./tableMapping');

class Mapping {
  constructor(entityName) {
    this.entityValues = { entity: entityName };
  }

  encodeEntity(entity) {
    if (!entity.entity) entity.entity = this.entityValues.entity;
    if (entity.version === undefined || entity.version === null)
      entity.version = 0;

    const decodedToEncodedMapping = getReversedMapping(encodedToDecodedMapping);
    return encodeEntity(
      entity,
      decodedToEncodedMapping,
      sortKeyConstruction,
      queryableAttributes
    );
  }

  decodeEntity(entity) {
    return decodeEntity(entity, encodedToDecodedMapping);
  }

  encodeAttachment(attachmentName) {
    return (attachment) => {
      const {
        entity,
        sortKeyConstruction,
        encodedToDecodedMapping,
        queryableAttributesForAttachment,
      } = getAttachmentMapping(attachmentName);
      const decodedToEncodedMapping = getReversedMapping(encodedToDecodedMapping);
  
      attachment.entity = `${this.entityValues.entity}_${entity}`;
      if (attachment.version === undefined || attachment.version === null)
        attachment.version = 0;
  
      return encodeEntity(
        attachment,
        decodedToEncodedMapping,
        sortKeyConstruction,
        queryableAttributesForAttachment
      );
    }
  }

  decodeAttachment(attachmentName) {
    return (attachment) => {
      const { encodedToDecodedMapping } = getAttachmentMapping(
        attachmentName,
        attachment
      );
  
      return decodeEntity(attachment, encodedToDecodedMapping);
    }
  }
}

function getAttachmentMapping(attachmentName) {
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

// The pk of a table is always prefixed with the value inside the entity field (this.entityValues.entity)
const encodedToDecodedMapping = {
  pk: "paymentId",
  eid1: "orderId",
  eid2: "stakeholderId",
};

const sortKeyConstruction = {
  sk: ["entity", "version"],
  esk: ["entity", "eventId", "status"],
};

// Because the order of the array determines the priority of the attribute when querying, this config will overwrite the global priority config
const queryableAttributes = ["pk", "eid1", "eid2", "e"];

const attachmentsMapping = {};

module.exports = Mapping;
