interface iGlobalConfig {
  entityName: String;
  dataSource: String;
  tableName: String;
}

const globalConfig: iGlobalConfig = {
  entityName: "payment",
  dataSource: "dynamodb",
  tableName: "fruitful-pineapple-prov"
}

export { globalConfig };