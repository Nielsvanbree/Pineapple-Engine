import { DynamoDB, PineappleSchemas } from "./dynamodb/index";
import { iMappingConfig } from "./dynamodb/mapping";

class Pineapple {
  #dynamodb: DynamoDB;
  #attachmentEntities: { [key: string]: Pineapple } = {};

  constructor({
    globalConfig: { dataSource, tableName, entityName, idGeneratorFunction, responseFormat, attachmentEntityConfigs },
    mappingConfig,
    schemas,
  }: {
    globalConfig: iGlobalConfig;
    mappingConfig: iMappingConfig;
    schemas: PineappleSchemas;
  }) {
    if (dataSource === "dynamodb") {
      this.#dynamodb = new DynamoDB(
        { tableName, entityName, idGeneratorFunction, responseFormat: responseFormat || "V1" },
        mappingConfig,
        schemas
      );

      attachmentEntityConfigs?.map(attachmentEntityConfig => {
        this.#attachmentEntities[attachmentEntityConfig.globalConfig.entityName] = new Pineapple(attachmentEntityConfig);
        // Object.defineProperty(this, attachmentEntityConfig.globalConfig.entityName, {
        //   value: new Pineapple(attachmentEntityConfig),
        //   writable: false
        // });
      });
    }
    else throw new Error("Unsupported data source!");
  }

  get dynamodb() {
    return this.#dynamodb;
  }

  public getAttachment(name: string) {
    if (!this.#attachmentEntities[name])
      new Error(`The attachment with name ${name} does not exist on this entity`);

    return this.#attachmentEntities[name];
  }
}

interface iGlobalConfig extends iGlobalConfigBase {
  attachmentEntityConfigs?: Array<{ globalConfig: iGlobalConfigBase, mappingConfig: iMappingConfig, schemas: PineappleSchemas }>;
}

interface iGlobalConfigBase {
  entityName: string;
  dataSource: string;
  tableName: string;
  idGeneratorFunction?: () => string;
  responseFormat?: "V1" | "V2";
}

export {
  Pineapple,
  iMappingConfig,
  iGlobalConfig,
};
