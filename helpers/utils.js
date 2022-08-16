const _ = require("lodash/fp/object");

module.exports = {
  /**
   * Compare 2 objects with each other. The output will be a set of asked keys with new and old values.
   * For arrays, it will output items in the following sets: newItems, deletedItems and comparableItems.
   * @param {Object} newObject - The newest version of the object.
   * @param {Object} oldObject - The older version of the object to compare to.
   * @param {Object} arrayConfig - Config for the arrays: { arrayKey: { type: 'ordered' | 'unOrdered', new: 'comparableKeyInNewObject', old: 'comparableKeyInOldObject' } }. ComparableKey is the connection between the 2 objects in case the array consists of objects.
   * @param {string} fullKey - Used internally.
   * @param {string} includedKeys - Keys to include in comparison. Keys not present in this set won't be compared. For nested object keys, use the dot notation: obj.nested.param. For object arrays, use [x]: array[x].key1.
   * @param {string} excludedKeys - Keys to exclude in comparison. Keys present in this set won't be compared. For nested object keys, use the dot notation: obj.nested.param. For object arrays, use [x]: array[x].key1.
   */
  compareObjects: function (
    newObject,
    oldObject,
    arrayConfig,
    fullKey,
    includedKeys,
    excludedKeys = ["createdAt", "createdBy", "updatedAt", "updatedBy"],
    arrayType
  ) {
    const newToOld = buildComparisonBetweenTwoObjects(
      newObject,
      oldObject,
      arrayConfig,
      fullKey,
      includedKeys,
      excludedKeys,
      arrayType
    );
    const oldToNew = buildComparisonBetweenTwoObjects(
      oldObject,
      newObject,
      arrayConfig,
      fullKey,
      includedKeys,
      excludedKeys,
      arrayType,
      true
    );
    return _.merge(newToOld.attr, oldToNew.attr);
  },
  compareVersions(
    versions,
    arrayConfig,
    excludedKeys = ["createdAt", "createdBy", "updatedAt", "updatedBy"]
  ) {
    if (!excludedKeys) excludedKeys = [];
    excludedKeys.push("changesToPreviousVersion");

    versions = versions.sort((a, b) => a.version - b.version);
    return versions.map((v, i) => {
      if (i !== 0)
        v.changesToPreviousVersion = module.exports.compareObjects(
          v,
          versions[i - 1],
          arrayConfig,
          undefined,
          undefined,
          excludedKeys
        );
      return v;
    });
  },
  setObject: function (obj, propertyPath, value) {
    setObjValue(propertyPath, value, obj);
    return obj;
  },
  checkForDifferenceInObjects(comparison, updateRequired = false) {
    Object.keys(comparison).forEach((key) => {
      if (!comparison[key].oldValue && !comparison[key].newValue)
        updateRequired = module.exports.checkForDifferenceInObjects(
          comparison[key],
          updateRequired
        );
      else if (comparison[key].newValue !== comparison[key].oldValue)
        updateRequired = true;
    });
    return updateRequired;
  },
  splitArrayIntoBatches: function (items, batchSize = 25) {
    let batches = [];

    for (let i = 0; i < items.length; i += batchSize)
      batches.push(items.slice(i, i + batchSize));

    return batches;
  },
};

function buildComparisonBetweenTwoObjects(
  newObject,
  oldObject,
  arrayComparisonKey,
  fullKey,
  includedKeys,
  excludedKeys,
  arrayType,
  reverse
) {
  let comparisonToOldObject = { attr: {} };

  Object.entries(newObject).map(([key, value]) => {
    const newFullKey = `${fullKey ? `${fullKey}.` : ""}${key}`;
    if (
      excludedKeys &&
      excludedKeys.includes(newFullKey.replace(/\[\d+\]/g, "[x]"))
    )
      return;
    if (
      includedKeys &&
      !includedKeys.some(
        (v) =>
          newFullKey.replace(/\[\d+\]/g, "[x]") === v ||
          v.startsWith(newFullKey + ".")
      )
    )
      return;

    if (typeof value === "object" && !Array.isArray(value)) {
      const res = buildComparisonBetweenTwoObjects(
        value,
        (oldObject && oldObject[key]) || undefined,
        arrayComparisonKey,
        newFullKey,
        includedKeys,
        excludedKeys,
        undefined,
        reverse
      );
      comparisonToOldObject.attr = _.merge(
        comparisonToOldObject.attr,
        res.attr
      );
    } else if (Array.isArray(value)) {
      value.forEach((arrayValue, i) => {
        if (typeof arrayValue !== "object") {
          let oldValue = oldObject ? oldObject[key] : undefined;
          let arrayOrder =
            (arrayComparisonKey && arrayComparisonKey[key].type) || "ordered";
          if (
            oldObject &&
            oldObject[key] &&
            Array.isArray(oldObject[key]) &&
            arrayOrder === "ordered"
          )
            oldValue = oldObject[key][i];
          else if (
            oldObject &&
            oldObject[key] &&
            Array.isArray(oldObject[key]) &&
            arrayOrder === "unOrdered"
          )
            oldValue = oldObject[key].includes(arrayValue)
              ? arrayValue
              : undefined;

          const arrayType = getArrayType(arrayValue, oldValue, reverse);
          addNewAttributeToComparison(
            comparisonToOldObject,
            {
              fullKey: `${newFullKey}[${i}]`,
              key: `${key}[${i}]`,
              newValue: arrayValue,
              oldValue,
              arrayType,
            },
            reverse
          );
          if (comparisonToOldObject.attr[key])
            comparisonToOldObject.attr[key] = convertToArray(
              comparisonToOldObject.attr[key]
            );
        } else {
          const newObj = arrayValue;
          const oldObj = findOldArrayObjectByKey(
            arrayComparisonKey[key].old,
            newObj[arrayComparisonKey[key].new],
            oldObject[key]
          );
          const arrayType = oldObj ? "comparableItems" : "newItems";
          const res = buildComparisonBetweenTwoObjects(
            newObj,
            oldObj,
            arrayComparisonKey,
            `${newFullKey}[${i}]`,
            includedKeys,
            excludedKeys,
            arrayType,
            reverse
          );

          if (res.attr[key]) res.attr[key] = convertToArray(res.attr[key]);
          if (
            comparisonToOldObject.attr[key] &&
            comparisonToOldObject.attr[key][arrayType]
          )
            comparisonToOldObject.attr[key][arrayType] =
              comparisonToOldObject.attr[key][arrayType].concat(
                res.attr[key][arrayType]
              );
          else
            comparisonToOldObject.attr = _.merge(
              comparisonToOldObject.attr,
              res.attr
            );
        }
      });
    } else
      addNewAttributeToComparison(
        comparisonToOldObject,
        {
          fullKey: newFullKey,
          key,
          newValue: value,
          oldValue: oldObject ? oldObject[key] : undefined,
          arrayType,
        },
        reverse
      );
  });

  return comparisonToOldObject;
}

function convertToArray(arrayObject) {
  Object.entries(arrayObject).forEach(([arrayTypeWithIndex, value]) => {
    if (!arrayTypeWithIndex.match(/\[\d+\]/)) return;
    const arrayType = arrayTypeWithIndex.replace(/\[\d+\]/, "");
    if (!arrayObject[arrayType]) arrayObject[arrayType] = [];
    arrayObject[arrayType].push(value);
    delete arrayObject[arrayTypeWithIndex];
  });
  return arrayObject;
}

function getArrayType(newValue, oldValue, reverse) {
  let arrayType;
  if (
    newValue === oldValue ||
    (newValue !== undefined && oldValue !== undefined && newValue !== oldValue)
  )
    arrayType = "comparableItems";
  else if (!reverse && newValue !== undefined && oldValue === undefined)
    arrayType = "newItems";
  else if (reverse && newValue !== undefined && oldValue === undefined)
    arrayType = "deletedItems";
  return arrayType;
}

function findOldArrayObjectByKey(comparisonKey, comparisonKeyValue, oldArray) {
  if (!oldArray || !Array.isArray(oldArray)) return undefined;
  for (let i = 0; i < oldArray.length; i++) {
    const itemObject = oldArray[i];
    if (
      itemObject[comparisonKey] &&
      itemObject[comparisonKey] === comparisonKeyValue
    )
      return itemObject;
  }
  return undefined;
}

function addNewAttributeToComparison(comparisonObject, attributes, reverse) {
  let keyComparison = {};

  Object.entries(attributes).forEach(([key, value]) => {
    const realKey = reverse ? reverseKey(key) : key;
    if (value !== undefined) keyComparison[realKey] = value;
  });

  if (
    (reverse &&
      keyComparison.newValue === undefined &&
      keyComparison.arrayType === undefined) ||
    keyComparison.arrayType === "deletedItems"
  )
    addNewAttr(keyComparison, comparisonObject);
  else if (!reverse) addNewAttr(keyComparison, comparisonObject);
}

function addNewAttr(keyComparison, comparisonObject) {
  if (keyComparison.arrayType)
    keyComparison.fullKey = keyComparison.fullKey.replace(
      /(\[\d+\])/,
      `.${keyComparison.arrayType}$1`
    );
  if (keyComparison.oldValue !== undefined && keyComparison.oldValue !== null)
    setObjValue(
      `${keyComparison.fullKey}.oldValue`,
      keyComparison.oldValue,
      comparisonObject.attr
    );
  if (keyComparison.newValue !== undefined && keyComparison.newValue !== null)
    setObjValue(
      `${keyComparison.fullKey}.newValue`,
      keyComparison.newValue,
      comparisonObject.attr
    );
}

function setObjValue(propertyPath, value, obj) {
  let properties = Array.isArray(propertyPath)
    ? propertyPath
    : propertyPath.split(".");

  if (properties.length > 1) {
    if (
      !obj.hasOwnProperty(properties[0]) ||
      typeof obj[properties[0]] !== "object"
    )
      obj[properties[0]] = {};
    return setObjValue(properties.slice(1), value, obj[properties[0]]);
  } else {
    obj[properties[0]] = value;
    return true;
  }
}

function reverseKey(key) {
  if (key === "oldValue") return "newValue";
  else if (key === "newValue") return "oldValue";
  return key;
}
