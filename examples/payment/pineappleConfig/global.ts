import { iGlobalConfig } from "../../../pineapple";

const globalConfig: iGlobalConfig = {
  entityName: "payment",
  dataSource: "dynamodb",
  tableName: "fruitful-development-pineapple-prov",
}

export { globalConfig };