const {
  encodeEntity,
  decodeEntity,
} = require('./tableMapping');

class Mapping {
  constructor(entityName, mappingConfig) {
    this.entityValues = { entity: entityName };
    this.mappingConfig = mappingConfig;
  }

  encodeEntity(entity) {
    if (!entity.entity) entity.entity = this.entityValues.entity;
    if (entity.version === undefined || entity.version === null)
      entity.version = 0;

    const decodedToEncodedMapping = getReversedMapping(this.mappingConfig.encodedToDecodedMapping);
    return encodeEntity(
      entity,
      decodedToEncodedMapping,
      this.mappingConfig.sortKeyConstruction,
      this.mappingConfig.queryableAttributes
    );
  }

  decodeEntity(entity) {
    return decodeEntity(entity, this.mappingConfig.encodedToDecodedMapping);
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
  if (!this.mapping.attachmentsMapping[attachmentName])
    throw {
      statusCode: 404,
      code: "ResourceNotFoundException",
      message: `No attachment with the name ${attachmentName} found`,
    };

  return this.mapping.attachmentsMapping[attachmentName];
}

function getReversedMapping(mappingToReverse) {
  const reversedMapping = {};

  Object.entries(mappingToReverse).forEach(([key, value]) => {
    reversedMapping[value] = key;
  });

  return reversedMapping;
}

module.exports = Mapping;
