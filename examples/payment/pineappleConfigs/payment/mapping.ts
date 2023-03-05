import { iMappingConfig } from "../../../../pineapple";

const mappingConfig: iMappingConfig = {
  // The pk of a table is always prefixed with the value inside the entity field (entityValues.entity)
  encodedToDecodedMapping: {
    pk: "paymentId",
    gsiPk1: "orderId",
    gsiPk2: "productId",
  },
  sortKeyConstruction: {
    sk: ["entity", "version"],
    gsiSk1: ["entity", "productId", "status"],
  },
  // Because the order of the array determines the priority of the attribute when querying, this config will overwrite the global priority config
  queryableAttributes: ["pk", "gsiPk1", "gsiPk2", "entity"],
}

export { mappingConfig };