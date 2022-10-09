import {
  TableInterface,
  QueryCommandInput,
  UpdateCommandInput,
  iGetDynamoRecordResponse,
  iListAllVersionsForEntityResponse,
  iUpdateDynamoRecordResponse,
  iListDynamoRecordsResponse,
  iListAttachmentsForEntityResponse,
} from "./tableInterface";
import { Mapping, iMappingConfig } from "./mapping";
import { j, validate } from "../helpers/joi";

class DynamoDB {
  #mapping: Mapping;
  #tableInterface: TableInterface;
  #schemas: PineappleSchemas;

  constructor(
    {
      tableName,
      entityName,
      idGeneratorFunction,
    }: {
      tableName: string;
      entityName: string;
      idGeneratorFunction?: () => string;
    },
    mappingConfig: iMappingConfig,
    schemas: PineappleSchemas
  ) {
    validateSchemasAreJoiSchemas(schemas);

    this.#mapping = new Mapping(entityName, mappingConfig, idGeneratorFunction);
    this.#tableInterface = new TableInterface(tableName);
    this.#schemas = schemas;
  }

  async get(
    entity: Record<string, any>,
    options?: { listVersions?: boolean, limit?: number, exclusiveStartKey?: string },
  ): Promise<iListAllVersionsForEntityResponse & iGetDynamoRecordResponse> {
    validate(
      j.object().keys({
        entity: j.object().required(),
        listVersions: j.bool().default(false),
        limit: j.number().integer().min(1).when("listVersions", {
          not: true,
          then: j.forbidden(),
        }),
        exclusiveStartKey: j.string().when("listVersions", {
          not: true,
          then: j.forbidden(),
        }),
      }),
      { entity, ...options },
      undefined,
      "interfaceInput"
    );

    if (options?.listVersions)
      return this.#listAllVersionsForEntity(entity, options?.limit, options?.exclusiveStartKey);

    this.#validateRequiredSchemaForFunction("getSchema");
    validate(this.#schemas.getSchema, entity, undefined, "interface");

    return this.#tableInterface.getDynamoRecord(entity, this.#mapping);
  }

  async list(
    entity: Record<string, any>,
    options?: { limit?: number, exclusiveStartKey?: string },
    callback?: (params: QueryCommandInput) => QueryCommandInput
  ): Promise<iListDynamoRecordsResponse> {
    this.#validateRequiredSchemaForFunction("listEntitySchema");
    validate(
      j.object().keys({
        entity: j.object().required(),
        limit: j.number().integer().min(1),
        exclusiveStartKey: j.string()
      }),
      { entity, ...options },
      undefined,
      "interfaceInput"
    );

    validate(this.#schemas.listEntitySchema, entity, undefined, "interface");

    return this.#tableInterface.listDynamoRecords(
      entity,
      this.#mapping,
      options?.limit,
      options?.exclusiveStartKey,
      callback
    );
  }

  async listAttachmentsForEntity(
    entityId: string,
    attachment: Record<string, any>,
    limit: number,
    exclusiveStartKey: string | any,
    callback: (params: QueryCommandInput) => QueryCommandInput
  ): Promise<iListAttachmentsForEntityResponse> {
    this.#validateRequiredSchemaForFunction("listAttachmentsSchema");
    validate(
      this.#schemas.listAttachmentsSchema,
      { attachment },
      undefined,
      "interface"
    );

    return this.#tableInterface.listAttachmentsForEntity(
      entityId,
      attachment,
      this.#mapping,
      limit,
      exclusiveStartKey,
      callback
    );
  }

  async update(
    entity: Record<string, any>,
    username: string,
    callback: (params: UpdateCommandInput) => UpdateCommandInput
  ): Promise<iUpdateDynamoRecordResponse> {
    this.#validateRequiredSchemaForFunction("interfaceUpdateSchema");
    this.#validateRequiredSchemaForFunction("interfaceCreateSchema");

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
          .try(
            this.#schemas.interfaceUpdateSchema,
            this.#schemas.interfaceCreateSchema
          ),
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

    return this.#tableInterface.updateDynamoRecord(
      entity,
      this.#mapping,
      username,
      callback
    );
  }

  async #listAllVersionsForEntity(
    { version, ...entity }: Record<string, any>,
    limit?: number,
    exclusiveStartKey?: string | any
  ): Promise<iListAllVersionsForEntityResponse> {
    this.#validateRequiredSchemaForFunction("getSchema");
    validate(this.#schemas.getSchema, entity, undefined, "interface");

    return this.#tableInterface.listAllVersionsForEntity(
      entity,
      this.#mapping,
      limit,
      exclusiveStartKey
    );
  }

  #validateRequiredSchemaForFunction(
    requiredSchemaName: PineappleSchemaNames
  ): void {
    if (!this.#schemas[requiredSchemaName])
      throw new Error(
        `Required schema for this call not set in the constructor of the Pineapple entity: ${requiredSchemaName}`
      );
  }
}

function validateSchemasAreJoiSchemas(schemas: PineappleSchemas): void {
  const faultySchemas = Object.entries(schemas)
    .map(([schemaName, schema]) => {
      return !j.isSchema(schema) ? schemaName : undefined;
    })
    .filter((s) => s);
  if (faultySchemas?.length > 0)
    throw new Error(
      `Invalid Joi schemas detected while trying to construct Pineapple entity: ${faultySchemas.join(
        ", "
      )}`
    );
}

type PineappleSchemaNames =
  | "createSchema"
  | "updateSchema"
  | "getSchema"
  | "interfaceCreateSchema"
  | "interfaceUpdateSchema"
  | "listAttachmentsSchema"
  | "listEntitySchema"
  | "outputEntitySchema";

type PineappleSchemas = { [key in PineappleSchemaNames]: object };

export { DynamoDB };
