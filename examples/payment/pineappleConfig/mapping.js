module.exports = {
  // The pk of a table is always prefixed with the value inside the entity field (entityValues.entity)
  encodedToDecodedMapping: {
    pk: "paymentId",
    eid1: "orderId",
    eid2: "productId",
  },
  sortKeyConstruction: {
    sk: ["entity", "version"],
    esk: ["entity", "productId", "status"],
  },
  // Because the order of the array determines the priority of the attribute when querying, this config will overwrite the global priority config
  queryableAttributes: ["pk", "eid1", "eid2", "e"],
  attachmentsMapping: {}
}