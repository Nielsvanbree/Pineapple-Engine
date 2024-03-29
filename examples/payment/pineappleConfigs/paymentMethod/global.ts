import { iGlobalConfig } from "../../../../pineapple";

const globalConfig: iGlobalConfig = {
  entityName: "paymentMethod",
  dataSource: "dynamodb",
  tableName: "fruitful-development-pineapple-prov",
  responseFormat: "V2",
  rootEntity: false,
  attachmentIdKeyName: "paymentMethodId"
}

export { globalConfig };