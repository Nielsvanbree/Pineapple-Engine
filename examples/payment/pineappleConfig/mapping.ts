interface iMappingConfig {
  encodedToDecodedMapping: {
    pk: String;
    gsiPk1?: String;
    gsiPk2?: String;
    gsiPk3?: String;
  },
  sortKeyConstruction: {
    sk: Array<String>;
    gsiSk1?: Array<String>;
  },
  queryableAttributes: Array<"pk" | "gsiPk1" | "gsiPk2" | "gsiPk3" | "entity">;
  attachmentsMapping: any;
}

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
  attachmentsMapping: {}
}

export { mappingConfig };