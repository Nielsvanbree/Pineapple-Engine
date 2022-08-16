const { v4: uuidv4 } = require("uuid");

module.exports = {
  encodeEntity(
    entity,
    entitySpecificMapping,
    sortKeyConstruction,
    queryableAttributesFromEntity
  ) {
    if (!entity || typeof entity !== "object")
      throw {
        statusCode: 400,
        code: "InvalidParameterException",
        message: "Malformed entity object",
      };

    const usedMapping = {
      ...decodedToEncodedMapping,
      ...entitySpecificMapping,
    };

    encodeEntityAttributes(entity, usedMapping);
    const { eskContains, eskMisses } = addSortKeysToEntity(
      entity,
      sortKeyConstruction,
      usedMapping
    );
    return prepEncodedEntityResponse(
      entity,
      eskContains,
      eskMisses,
      sortKeyConstruction,
      queryableAttributesFromEntity,
      usedMapping
    );
  },
  decodeEntity(entity, entitySpecificMapping) {
    if (!entity || typeof entity !== "object")
      throw {
        statusCode: 400,
        code: "InvalidParameterException",
        message: "Malformed entity object",
      };

    const usedMapping = {
      ...encodedToDecodedMapping,
      ...entitySpecificMapping,
    };

    return decodeEntityAttributes(entity, usedMapping);
  },
};

function addSortKeysToEntity(entity, sortKeyConstruction, usedMapping) {
  let eskContains = [],
    eskMisses = [];
  Object.entries(sortKeyConstruction).forEach(([key, constructionArray]) => {
    let value = "";

    for (let i = 0; i < constructionArray.length; i++) {
      const encodedKeyName = usedMapping[constructionArray[i]]
        ? usedMapping[constructionArray[i]]
        : constructionArray[i];
      if (i !== 0) value += "#";
      if (
        entity[encodedKeyName] === undefined ||
        entity[encodedKeyName] === null
      )
        break;
      value +=
        encodedKeyName === "v"
          ? `v${entity[encodedKeyName]}`
          : entity[encodedKeyName];

      if (key === "esk") eskContains.push(encodedKeyName);
    }

    entity[key] = value;
  });

  if (
    sortKeyConstruction.esk &&
    sortKeyConstruction.esk.length !== eskContains.length
  ) {
    sortKeyConstruction.esk.forEach((key) => {
      const encodedKeyName = usedMapping[key] ? usedMapping[key] : key;
      if (!eskContains.includes(encodedKeyName)) eskMisses.push(encodedKeyName);
    });
  }

  return { entity, eskContains, eskMisses };
}

function encodeEntityAttributes(entity, usedMapping) {
  Object.entries(entity).map(([key, value]) => {
    if (usedMapping[key]) {
      entity[usedMapping[key]] = value;
      delete entity[key];
    }
  });

  return entity;
}

function decodeEntityAttributes(entity, usedMapping) {
  Object.entries(entity).map(([key, value]) => {
    if (usedMapping[key]) {
      entity[usedMapping[key]] = value;
      delete entity[key];
    }
  });

  // These values should never be necessary to work with in your code, so we can leave them out when decoding
  if (entity.sk) delete entity.sk;
  if (entity.esk) delete entity.esk;
  if (entity.entity) delete entity.entity;

  return entity;
}

function prepEncodedEntityResponse(
  entity,
  eskContains,
  eskMisses,
  sortKeyConstruction,
  queryableAttributesFromEntity,
  usedMapping
) {
  const newItem = entity.pk ? false : true;
  let response = {
    pk: `${newItem ? `${entity.e}_${uuidv4()}` : entity.pk}`,
    sk: entity.sk,
    newItem,
    attributes: {},
    creationAttributes: {},
    queryableAttributes: queryableAttributesFromEntity
      ? queryableAttributesFromEntity
      : queryableAttributes,
    eskContains,
    eskMisses,
    sortKeyConstruction,
    usedMapping,
  };
  delete entity.pk, entity.sk;

  Object.entries(entity).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (creationAttributes.includes(key))
        response.creationAttributes[key] = value;
      else if (!keyAttributes.includes(key)) response.attributes[key] = value;
    }
  });

  return response;
}

const encodedToDecodedMapping = {
  e: "entity",
  t: "type",
  s: "status",
  r: "role",
  v: "version",
  lv: "latestVersion",
  ca: "createdAt",
  cb: "createdBy",
  ua: "updatedAt",
  ub: "updatedBy",
};

const decodedToEncodedMapping = {
  entity: "e",
  type: "t",
  status: "s",
  role: "r",
  version: "v",
  latestVersion: "lv",
  createdAt: "ca",
  createdBy: "cb",
  updatedAt: "ua",
  updatedBy: "ub",
};

// These attributes are only created, never updated
const creationAttributes = ["v", "e", "ca", "cb"];

// Key attributes of the base table
const keyAttributes = ["pk", "sk"];

// Attributes that can be used to query with
// The order of the array determines the priority of the attribute when listing
const queryableAttributes = ["pk", "eid1", "eid2", "e"];
