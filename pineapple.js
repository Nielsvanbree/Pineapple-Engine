const DynamoDB = require("./dynamodb/index");

class Pineapple {  
  constructor({ globalConfig: { dataSource, tableName, entityName }, mappingConfig, schemas }) {
    if (dataSource === "dynamodb")
      this.dynamodb = new DynamoDB({ tableName, entityName }, mappingConfig, schemas);
    else
      throw new Error("Unsupported data source!");
  }
}

module.exports = Pineapple;