import { TableInterface, QueryCommandInput, UpdateCommandInput } from "./tableInterface";
import { Mapping, iMappingConfig } from "./mapping";
import { j, validate } from "../helpers/joi";

class DynamoDB {
  mapping: Mapping;
  tableInterface: any;
  schemas: any;

  constructor({ tableName, entityName }: { tableName: string, entityName: string }, mappingConfig: iMappingConfig, schemas: any) {
    this.mapping = new Mapping(entityName, mappingConfig);
    this.tableInterface = new TableInterface(tableName);
    this.schemas = schemas;
  }

  async get(
    entity: Record<string, any>,
    listVersions?: boolean,
    limit?: number,
    exclusiveStartKey?: string | any,
    versionsCallback?: (versions: Array<any>, compareVersions: Function) => Array<any>
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
      this.mapping,
    );
  }

  async list(entity: Record<string, any>, limit: number, exclusiveStartKey: string | any, callback: (params: QueryCommandInput) => QueryCommandInput) {
    validate(this.schemas.listEntitySchema, entity, undefined, "interface");

    return this.tableInterface.listDynamoRecords(
      entity,
      this.mapping,
      limit,
      exclusiveStartKey,
      callback
    );
  }

  async listAttachmentsForEntity(
    entityId: any,
    attachment: any,
    limit: number,
    exclusiveStartKey: string | any,
    callback: (params: any) => any
  ) {
    validate(this.schemas.listAttachmentsSchema, { attachment }, undefined, "interface");

    return this.tableInterface.listAttachmentsForEntity(
      entityId,
      attachment,
      this.mapping,
      limit,
      exclusiveStartKey,
      callback
    );
  }

  async update(entity: Record<string, any>, username: string, callback: (params: UpdateCommandInput) => UpdateCommandInput) {
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
      this.mapping,
      username,
      callback
    );
  }

  async #listAllVersionsForEntity(
    { version, ...entity }: any,
    limit?: number,
    exclusiveStartKey?: string | any,
    versionsCallback?: (versions: Array<any>, compareVersions: Function) => Array<any>
  ) {
    validate(this.schemas.getSchema, entity, undefined, "interface");
  
    return this.tableInterface.listAllVersionsForEntity(
      entity,
      this.mapping,
      limit,
      exclusiveStartKey,
      versionsCallback
    );
  }
};

export { DynamoDB };