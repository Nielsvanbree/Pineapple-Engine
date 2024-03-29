import {
  TableInterface,
  QueryCommandInput,
  UpdateCommandInput,
  GetCommandInput,
  iGetDynamoRecordResponse,
  iListAllVersionsForEntityResponse,
  iUpdateDynamoRecordResponse,
  iListDynamoRecordsResponse,
} from "./tableInterface";
import { Mapping, iMappingConfig } from "./mapping";
import { j, validate } from "../helpers/joi";
import { unpackStreamRecord, DynamoDBRecord } from "../helpers/dynamodb";

class DynamoDB {
  #mapping: Mapping;
  #tableInterface: TableInterface;
  #schemas: PineappleSchemas;
  #responseFormat: "V1" | "V2";

  constructor(
    {
      tableName,
      entityName,
      idGeneratorFunction,
      responseFormat,
      attachmentIdKeyName,
    }: {
      tableName: string;
      entityName: string;
      idGeneratorFunction?: () => string;
      responseFormat: "V1" | "V2";
      attachmentIdKeyName?: string;
    },
    mappingConfig: iMappingConfig,
    schemas: PineappleSchemas
  ) {
    validateSchemasAreJoiSchemas(schemas);
    validate(
      j.object().keys({
        global: j
          .object()
          .keys({
            tableName: j.string().required(),
            entityName: j.string().required(),
            idGeneratorFunction: j.func(),
          })
          .required(),
        mappingConfig: j.object().required(),
        schemas: j.object().required(),
      }),
      {
        global: { tableName, entityName, idGeneratorFunction },
        mappingConfig,
        schemas,
      },
      undefined,
      "pineappleInitialization",
      () => {
        return "Something went wrong when initializing your Pineapple class. Please check your input.";
      }
    );

    this.#mapping = new Mapping(
      entityName,
      mappingConfig,
      attachmentIdKeyName,
      idGeneratorFunction
    );
    this.#tableInterface = new TableInterface(tableName);
    this.#schemas = schemas;
    this.#responseFormat = responseFormat;
  }

  async get(
    entity: Record<string, any>,
    options?: {
      listVersions?: boolean;
      limit?: number;
      exclusiveStartKey?: string;
      paramsOnly?: boolean;
    },
    callbacks?: {
      getCallback?: (params: GetCommandInput) => GetCommandInput,
      listVersionsCallback?: (
        versionParams: QueryCommandInput,
        latestVersionParams: GetCommandInput
      ) => {
        versionParams: QueryCommandInput;
        latestVersionParams: GetCommandInput;
      }
    }
  ): Promise<iListAllVersionsForEntityResponse & iGetDynamoRecordResponse> {
    validate(
      j.object().keys({
        entity: j.object().required(),
        options: j.object().keys({
          listVersions: j.bool().default(false),
          limit: j.number().integer().min(1).when("listVersions", {
            not: true,
            then: j.forbidden(),
          }),
          exclusiveStartKey: j.string().when("listVersions", {
            not: true,
            then: j.forbidden(),
          }),
          paramsOnly: j.bool().default(false),
        }),
        callbacks: j.object().keys({
          getCallback: j.when("/options.listVersions", {
            is: true,
            then: j.forbidden(),
            otherwise: j.func()
          }),
          listVersionsCallback: j.when("/options.listVersions", {
            is: true,
            then: j.func(),
            otherwise: j.forbidden()
          })
        })
      }),
      { entity, options, callbacks },
      undefined,
      "interfaceInput",
      () => {
        return "Your input in the get requested doesn't conform the schema. Please check your input.";
      }
    );

    if (options?.listVersions)
      return this.#listAllVersionsForEntity(
        entity,
        options?.limit,
        options?.exclusiveStartKey,
        options?.paramsOnly,
        callbacks?.listVersionsCallback
      );

    this.#validateRequiredSchemaForFunction("getSchema");
    const validatedEntity = validate(
      this.#schemas.getSchema,
      entity,
      undefined,
      "interface"
    );

    return this.#tableInterface.getDynamoRecord(
      validatedEntity,
      this.#mapping,
      callbacks?.getCallback,
      options?.paramsOnly
    );
  }

  async list(
    entity: Record<string, any>,
    options?: {
      limit?: number;
      exclusiveStartKey?: string;
      paramsOnly?: boolean;
    },
    callback?: (params: QueryCommandInput) => QueryCommandInput
  ): Promise<iListDynamoRecordsResponse> {
    this.#validateRequiredSchemaForFunction("listEntitySchema");
    validate(
      j.object().keys({
        entity: j.object().required(),
        options: j.object().keys({
          limit: j.number().integer().min(1),
          exclusiveStartKey: j.string(),
          paramsOnly: j.bool().default(false),
        }),
      }),
      { entity, options },
      undefined,
      "interfaceInput",
      () => {
        return "Your input in the list requested doesn't conform the schema. Please check your input.";
      }
    );

    const validatedEntity = validate(
      this.#schemas.listEntitySchema,
      entity,
      undefined,
      "interface"
    );

    const { items, lastEvaluatedKey, params } =
      await this.#tableInterface.listDynamoRecords(
        validatedEntity,
        this.#mapping,
        options?.limit,
        options?.exclusiveStartKey,
        this.#mapping.attachmentIdKeyName,
        callback,
        options?.paramsOnly
      );

    if (options?.paramsOnly) return { params };

    return {
      items:
        this.#responseFormat === "V1"
          ? items
          : items?.map(({ entity }) => ({ ...entity })),
      lastEvaluatedKey,
    };
  }

  async update(
    entity: Record<string, any>,
    options: {
      executorUsername: string;
      paramsOnly?: boolean;
    },
    callback?: (params: UpdateCommandInput) => UpdateCommandInput
  ): Promise<iUpdateDynamoRecordResponse> {
    this.#validateRequiredSchemaForFunction("interfaceUpdateSchema");
    this.#validateRequiredSchemaForFunction("interfaceCreateSchema");
    validate(
      j.object().keys({
        entity: j.object().required(),
        options: j
          .object()
          .keys({
            executorUsername: j.string().required(),
            paramsOnly: j.bool().default(false),
          })
          .required(),
      }),
      { entity, options },
      undefined,
      "interfaceInput",
      () => {
        return "Your input in the update requested doesn't conform the schema. Please check your input.";
      }
    );

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
        authorizer: { username: options.executorUsername },
      },
      entity,
    };

    const { entity: validatedEntity } = validate(
      schema,
      input,
      undefined,
      "interface"
    );

    return this.#tableInterface.updateDynamoRecord(
      validatedEntity,
      this.#mapping,
      options.executorUsername,
      options.paramsOnly,
      callback
    );
  }

  unpackStreamRecord(streamRecord: DynamoDBRecord): {
    eventName?: "INSERT" | "MODIFY" | "REMOVE";
    oldImage?: Record<string, any>;
    newImage?: Record<string, any>;
    rawOldImage?: Record<string, any>;
    rawNewImage?: Record<string, any>;
  } {
    validate(
      j.object().keys({
        streamRecord: j
          .object()
          .keys({
            eventName: j.string().valid("INSERT", "MODIFY", "REMOVE"),
            dynamodb: j
              .object()
              .keys({
                OldImage: j.object().keys(),
                NewImage: j.object().keys(),
              })
              .required()
              .unknown(),
          })
          .required()
          .unknown(),
      }),
      { streamRecord },
      undefined,
      "interfaceInput",
      () => {
        return "Your input in the unpackStreamRecord doesn't conform the schema. Please check if your input is a valid DynamoDB stream record.";
      }
    );

    const { oldImage, newImage } = unpackStreamRecord({
      dynamodb: streamRecord.dynamodb,
    });

    return {
      eventName: streamRecord.eventName,
      rawOldImage: oldImage,
      rawNewImage: newImage,
      oldImage: oldImage
        ? this.#mapping.decodeEntity(JSON.parse(JSON.stringify(oldImage)))
        : undefined,
      newImage: newImage
        ? this.#mapping.decodeEntity(JSON.parse(JSON.stringify(newImage)))
        : undefined,
    };
  }

  async #listAllVersionsForEntity(
    { version, ...entity }: Record<string, any>,
    limit?: number,
    exclusiveStartKey?: string | any,
    paramsOnly?: boolean | undefined,
    callback?: (
      versionParams: QueryCommandInput,
      latestVersionParams: GetCommandInput
    ) => {
      versionParams: QueryCommandInput;
      latestVersionParams: GetCommandInput;
    }
  ): Promise<iListAllVersionsForEntityResponse> {
    this.#validateRequiredSchemaForFunction("getSchema");
    const validatedEntity = validate(
      this.#schemas.getSchema,
      entity,
      undefined,
      "interface"
    );

    return this.#tableInterface.listAllVersionsForEntity(
      validatedEntity,
      this.#mapping,
      limit,
      exclusiveStartKey,
      callback,
      paramsOnly
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
  | "listEntitySchema"
  | "outputEntitySchema";

type PineappleSchemas = { [key in PineappleSchemaNames]: j.ObjectSchema };

export { DynamoDB };
