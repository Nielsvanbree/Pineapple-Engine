import { iGlobalConfig } from "../../../pineapple";
import { pineappleConfig as paymentMethodPineappleConfig } from "./attachmentConfigs/paymentMethod";

const globalConfig: iGlobalConfig = {
  entityName: "payment",
  dataSource: "dynamodb",
  tableName: "fruitful-development-pineapple-prov",
  responseFormat: "V2",
  attachmentEntityConfigs: [
    paymentMethodPineappleConfig
  ]
}

export { globalConfig };