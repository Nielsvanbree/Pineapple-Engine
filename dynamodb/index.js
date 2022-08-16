const TableInterface = require('./tableInterface');
const Mapping = require("./mapping");
const { j, validate } = require('../helpers/joi');
// const {
//   interfaceCreateSchema,
//   getSchema,
//   listEntitySchema,
//   listAttachmentsSchema,
//   interfaceUpdateSchema,
// } = require("./schema");

class DynamoDB {
  constructor(tableName, entityName) {
    this.mapping = new Mapping(entityName);
    this.tableInterface = new TableInterface(tableName);
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

    // validate(getSchema, entity, undefined, "interface");

    return this.tableInterface.getDynamoRecord(
      entity,
      this.mapping.encodeEntity.bind(this.mapping),
      this.mapping.decodeEntity.bind(this.mapping),
      this.mapping.encodeAttachment.bind(this.mapping),
      this.mapping.decodeAttachment.bind(this.mapping)
    );
  }

  async listDynamoRecords(entity, limit, exclusiveStartKey, callback) {
    // validate(listEntitySchema, entity, undefined, "interface");

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
    // validate(listAttachmentsSchema, { attachment }, undefined, "interface");

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
    // const schema = j
    //   .object()
    //   .keys({
    //     requestContext: j.object().keys({
    //       authorizer: j.object().keys({
    //         username: j.string(),
    //       }),
    //     }),
    //     entity: j
    //       .alternatives()
    //       .try(interfaceUpdateSchema, interfaceCreateSchema),
    //   })
    //   .unknown()
    //   .required();

    // const input = {
    //   requestContext: {
    //     authorizer: { username },
    //   },
    //   entity,
    // };

    // validate(schema, input, undefined, "interface");

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
    // validate(getSchema, entity, undefined, "interface");
  
    return this.tableInterface.listAllVersionsForEntity(
      entity,
      this.mapping.encodeEntity.bind(this.mapping),
      this.mapping.decodeEntity.bind(this.mapping),
      this.mapping.encodeAttachment.bind(this.mapping),
      this.mapping.decodeAttachment.bind(this.mapping),
      limit,
      exclusiveStartKey,
      versionsCallback
    );
  }
};

module.exports = DynamoDB;