import { DynamoDB } from "./dynamodb/index";
import { iMappingConfig } from "./dynamodb/mapping";

class Pineapple {  
  dynamodb: DynamoDB;

  constructor({ globalConfig: { dataSource, tableName, entityName }, mappingConfig, schemas }: { globalConfig: iGlobalConfig, mappingConfig: iMappingConfig, schemas: any }) {
    if (dataSource === "dynamodb")
      this.dynamodb = new DynamoDB({ tableName, entityName }, mappingConfig, schemas);
    else
      throw new Error("Unsupported data source!");
  }
}

interface iGlobalConfig {
  entityName: string;
  dataSource: string;
  tableName: string;
}

export { Pineapple, iMappingConfig, iGlobalConfig };