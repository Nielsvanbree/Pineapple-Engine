import { merge } from "lodash/fp";

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
  function compareObjects(
  newObject: any,
  oldObject: any,
  arrayConfig: any,
  fullKey: String,
  includedKeys: Array<any>,
  excludedKeys = ["createdAt", "createdBy", "updatedAt", "updatedBy"],
  arrayType: any
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
  return merge(newToOld.attr, oldToNew.attr);
};

function compareVersions(
  versions: Array<any>,
  arrayConfig: any,
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
};

function setObject(obj: any, propertyPath: String, value: any) {
  setObjValue(propertyPath, value, obj);
  return obj;
};

function checkForDifferenceInObjects(comparison: any, updateRequired = false) {
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
};

function splitArrayIntoBatches(items: Array<any>, batchSize = 25) {
  let batches = [];

  for (let i = 0; i < items.length; i += batchSize)
    batches.push(items.slice(i, i + batchSize));

  return batches;
};


export { compareObjects, compareVersions, setObject, checkForDifferenceInObjects, splitArrayIntoBatches };

module.exports = {
};

function buildComparisonBetweenTwoObjects(
  newObject: any,
  oldObject: any,
  arrayComparisonKey: any,
  fullKey: String,
  includedKeys: Array<String>,
  excludedKeys: Array<String>,
  arrayType: String | undefined,
  reverse?: any
) {
  let comparisonToOldObject: any = { attr: {} };

  Object.entries(newObject).map(([key, value]: [any, any]) => {
    const newFullKey = `${fullKey ? `${fullKey}.` : ""}${key}`;
    if (
      excludedKeys &&
      excludedKeys.includes(newFullKey.replace(/\[\d+\]/g, "[x]"))
    )
      return;
    if (
      includedKeys &&
      !includedKeys.some(
        (v: String) =>
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
      comparisonToOldObject.attr = merge(
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
            comparisonToOldObject.attr = merge(
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

function convertToArray(arrayObject: Array<any>) {
  Object.entries(arrayObject).forEach(([arrayTypeWithIndex, value]: [any, any]) => {
    if (!arrayTypeWithIndex.match(/\[\d+\]/)) return;
    const arrayType: any = arrayTypeWithIndex.replace(/\[\d+\]/, "");
    if (!arrayObject[arrayType]) arrayObject[arrayType] = [];
    arrayObject[arrayType].push(value);
    delete arrayObject[arrayTypeWithIndex];
  });
  return arrayObject;
}

function getArrayType(newValue: any, oldValue: any, reverse: any) {
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

function findOldArrayObjectByKey(comparisonKey: any, comparisonKeyValue: any, oldArray: Array<any>) {
  if (!oldArray || !Array.isArray(oldArray)) return undefined;
  for (let i = 0; i < oldArray.length; i++) {
    const itemObject: any = oldArray[i];
    if (
      itemObject[comparisonKey] &&
      itemObject[comparisonKey] === comparisonKeyValue
    )
      return itemObject;
  }
  return undefined;
}

function addNewAttributeToComparison(comparisonObject: any, attributes: any, reverse: any) {
  let keyComparison: any = {};

  Object.entries(attributes).forEach(([key, value]) => {
    const realKey: any = reverse ? reverseKey(key) : key;
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

function addNewAttr(keyComparison: any, comparisonObject: any) {
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

function setObjValue(propertyPath: String, value: any, obj: any): any {
  let properties: any = Array.isArray(propertyPath)
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

function reverseKey(key: String) {
  if (key === "oldValue") return "newValue";
  else if (key === "newValue") return "oldValue";
  return key;
}
