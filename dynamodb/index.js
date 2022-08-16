const TableInterface = require('./tableInterface');
const Mapping = require("./mapping");
const { j, validate } = require('../helpers/joi');

class DynamoDB {
  constructor({ tableName, entityName }, mappingConfig, schemas) {
    this.mapping = new Mapping(entityName, mappingConfig);
    this.tableInterface = new TableInterface(tableName);
    this.schemas = schemas;
  }

  async getDynamoRecord(
    entity,
    listVersions,
    limit,
    exclusiveStartKey,
    versionsCallback
  ) {
    if (listVersions)
      return this.#listAllVersionsForEntity(
        entity,
        limit,
        exclusiveStartKey,
        versionsCallback
      );

    validate(this.schemas.getSchema, entity, undefined, "interface");

    return this.tableInterface.getDynamoRecord(
      entity,
      this.mapping.encodeEntity.bind(this.mapping),
      this.mapping.decodeEntity.bind(this.mapping),
      this.mapping.encodeAttachment.bind(this.mapping),
      this.mapping.decodeAttachment.bind(this.mapping)
    );
  }

  async listDynamoRecords(entity, limit, exclusiveStartKey, callback) {
    validate(this.schemas.listEntitySchema, entity, undefined, "interface");

    return this.tableInterface.listDynamoRecords(
      entity,
      this.mapping.encodeEntity.bind(this.mapping),
      this.mapping.decodeEntity.bind(this.mapping),
      this.mapping.encodeAttachment.bind(this.mapping),
      this.mapping.decodeAttachment.bind(this.mapping),
      limit,
      exclusiveStartKey,
      callback
    );
  }

  async listAttachmentsForEntity(
    entityId,
    attachment,
    limit,
    exclusiveStartKey,
    callback
  ) {
    validate(this.schemas.listAttachmentsSchema, { attachment }, undefined, "interface");

    return this.tableInterface.listAttachmentsForEntity(
      entityId,
      attachment,
      this.mapping.encodeEntity.bind(this.mapping),
      this.mapping.decodeEntity.bind(this.mapping),
      this.mapping.encodeAttachment.bind(this.mapping),
      this.mapping.decodeAttachment.bind(this.mapping),
      limit,
      exclusiveStartKey,
      callback
    );
  }

  async updateDynamoRecord(entity, username, callback) {
    // We build the schema with requestContext's username, because that allows internal updates by other Lambdas by authorizing on the username in the schema
    const schema = j
      .object()
      .keys({
        requestContext: j.object().keys({
          authorizer: j.object().keys({
            username: j.string(),
          }),
        }),
        entity: j
          .alternatives()
          .try(this.schemas.interfaceUpdateSchema, this.schemas.interfaceCreateSchema),
      })
      .unknown()
      .required();

    const input = {
      requestContext: {
        authorizer: { username },
      },
      entity,
    };

    validate(schema, input, undefined, "interface");

    return this.tableInterface.updateDynamoRecord(
      entity,
      this.mapping.encodeEntity.bind(this.mapping),
      this.mapping.decodeEntity.bind(this.mapping),
      this.mapping.encodeAttachment.bind(this.mapping),
      this.mapping.decodeAttachment.bind(this.mapping),
      username,
      callback
    );
  }

  async #listAllVersionsForEntity(
    { version, ...entity },
    limit,
    exclusiveStartKey,
    versionsCallback
  ) {
    validate(this.schemas.getSchema, entity, undefined, "interface");
  
    return this.tableInterface.listAllVersionsForEntity(
      entity,
      this.mapping.encodeEntity.bind(this.mapping),
      this.mapping.decodeEntity.bind(this.mapping),
      this.mapping.encodeAttachment.bind(this.mapping),
      this.mapping.decodeAttachment.bind(this.mapping),
      limit,
      exclusiveStartKey,
      this.mapping.entityValues,
      versionsCallback
    );
  }
};

module.exports = DynamoDB;