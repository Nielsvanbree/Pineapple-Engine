import { DynamoDB } from "./dynamodb/index";
import { iMappingConfig } from "./dynamodb/mapping";
import * as pineappleUtils from "./helpers/utils";
import * as pineappleJoi from "./helpers/joi";

class Pineapple {
  #dynamodb: DynamoDB;

  constructor({
    globalConfig: { dataSource, tableName, entityName, idGeneratorFunction },
    mappingConfig,
    schemas,
  }: {
    globalConfig: iGlobalConfig;
    mappingConfig: iMappingConfig;
    schemas: any;
  }) {
    if (dataSource === "dynamodb")
      this.#dynamodb = new DynamoDB(
        { tableName, entityName, idGeneratorFunction },
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
}

export {
  Pineapple,
  iMappingConfig,
  iGlobalConfig,
  pineappleUtils,
  pineappleJoi,
};
