import { DynamoDB } from "./dynamodb/index";
import { iMappingConfig } from "./dynamodb/mapping";

class Pineapple {
  #dynamodb: DynamoDB;

  constructor({
    globalConfig: {
      dataSource,
      tableName,
      entityName,
      idGeneratorFunction,
      responseFormat,
      rootEntity,
      attachmentIdKeyName,
    },
    mappingConfig,
    schemas,
  }: {
    globalConfig: iGlobalConfig;
    mappingConfig: iMappingConfig;
    schemas: any;
  }) {
    if (!rootEntity && !attachmentIdKeyName)
      throw new Error(
        "Please specify the unique attachmentIdKeyName as this is mandatory for a non root entity"
      );

    if (dataSource === "dynamodb")
      this.#dynamodb = new DynamoDB(
        {
          tableName,
          entityName,
          idGeneratorFunction,
          responseFormat: responseFormat || "V1",
          attachmentIdKeyName
        },
        mappingConfig,
        schemas
      );
    else throw new Error("Unsupported data source!");
  }

  get dynamodb() {
    return this.#dynamodb;
  }
}

interface iGlobalConfig {
  entityName: string;
  dataSource: string;
  tableName: string;
  idGeneratorFunction?: () => string;
  responseFormat?: "V1" | "V2";
  rootEntity: boolean;
  attachmentIdKeyName?: string;
}

export { Pineapple, iMappingConfig, iGlobalConfig };
