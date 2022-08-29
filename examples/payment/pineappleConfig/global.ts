import { iGlobalConfig } from "../../../pineapple";

const globalConfig: iGlobalConfig = {
  entityName: "payment",
  dataSource: "dynamodb",
  tableName: "fruitful-pineapple-prov"
}

export { globalConfig };