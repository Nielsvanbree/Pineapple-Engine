const AWSXRay = require("aws-xray-sdk");
const AWS = require("aws-sdk");

if (process.env.AWS_REGION)
  AWS.config.update({ region: process.env.AWS_REGION });

if (process.env.IS_LOCAL !== "true") {
  AWSXRay.captureAWS(AWS);
}

const https = require("https");
const agent = new https.Agent({
  keepAlive: true,
});

const documentClient = new AWS.DynamoDB.DocumentClient({
  httpOptions: {
    agent,
  },
});
const dynamodbTranslator = documentClient.getTranslator();

const ItemShape =
  documentClient.service.api.operations.getItem.output.members.Item;

module.exports = {
  dynamoGetPineapple: async function (TableName, pk, sk) {
    const params = {
      TableName,
      Key: {
        pk,
        sk,
      },
    };
    return (await module.exports.get(params)).item;
  },

  update: async function (params) {
    var defaultParams = {
      ReturnValues: "ALL_NEW",
    };

    params = Object.assign({}, defaultParams, params);

    try {
      var dynamoResult = await documentClient.update(params).promise();
      return transformResult(dynamoResult);
    } catch (error) {
      var options = {
        service: {
          name: "DynamoDB",
          method: "update",
          params: params,
        },
      };
      console.log(JSON.stringify(options, null, 2));
      throw error;
    }
  },

  dynamoUpdatePineapple: async function (
    TableName,
    pk,
    sk,
    newItem,
    executorId,
    attributes,
    createdAttributes,
    returnParams = false,
    sameItemCheck = true,
    newItemCheck = true,
    attributeCallback
  ) {
    const now = new Date().toISOString();
    let params = {
      TableName,
      Key: {
        pk,
        sk,
      },
      ExpressionAttributeNames: {
        "#updatedAt": "ua",
        "#updatedBy": "ub",
        "#latestVersion": "lv",
      },
      ExpressionAttributeValues: {
        ":updatedAt": now,
        ":updatedBy": executorId,
        ":latestVersion": 1,
      },
      UpdateExpression:
        "ADD #latestVersion :latestVersion SET #updatedAt = :updatedAt, #updatedBy = :updatedBy",
      ReturnValues: "ALL_NEW",
    };

    if (newItem) {
      attributes = {
        ...attributes,
        ...createdAttributes,
        ca: now,
        cb: executorId,
      };
      if (newItemCheck)
        params.ConditionExpression =
          "attribute_not_exists(pk) AND attribute_not_exists(sk)";
    } else if (!newItem && sameItemCheck)
      params.ConditionExpression =
        "attribute_exists(pk) AND attribute_exists(sk)";

    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        let decodedKey = key;
        if (attributeCallback) decodedKey = attributeCallback(key, value);

        params["ExpressionAttributeNames"][`#${decodedKey}`] = key;
        params["ExpressionAttributeValues"][`:${decodedKey}`] = value;
        params["UpdateExpression"] += `, #${decodedKey} = :${decodedKey}`;
      }
    });

    let addedRemoveKeyword = false;
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === "") {
        let decodedKey = key;
        if (attributeCallback) decodedKey = attributeCallback(key, value);

        params["ExpressionAttributeNames"][`#${decodedKey}`] = key;
        params["UpdateExpression"] += addedRemoveKeyword
          ? `, #${decodedKey}`
          : ` REMOVE #${decodedKey}`;
        addedRemoveKeyword = true;
      }
    });

    if (returnParams) return params;

    return (await module.exports.update(params)).item;
  },

  query: async function (params) {
    try {
      var dynamoResult = await documentClient.query(params).promise();
      return transformResult(dynamoResult);
    } catch (error) {
      var options = {
        service: {
          name: "DynamoDB",
          method: "query",
          params: params,
        },
      };
      console.log(JSON.stringify(options, null, 2));
      throw error;
    }
  },

  unpackStreamRecord: function ({ eventName, dynamodb }) {
    const { OldImage, NewImage } = dynamodb;
    let oldImage;
    let newImage;

    if (OldImage) oldImage = module.exports.translateStreamImage(OldImage);

    if (NewImage) newImage = module.exports.translateStreamImage(NewImage);

    return { eventName, oldImage, newImage };
  },

  translateStreamImage: function (image) {
    return dynamodbTranslator.translateOutput(image, ItemShape);
  },

  // Function to strip the DynamoDB object from things like createdAt & createdBy
  stripDynamoObject: function (dynamoObject) {
    const attributesToStrip = [
      "createdAt",
      "createdBy",
      "updatedAt",
      "updatedBy",
      "sortId",
      "extSortId",
      "entity",
    ];

    attributesToStrip.forEach((ats) => {
      if (dynamoObject[ats]) delete dynamoObject[ats];
    });

    return dynamoObject;
  },
};

async function transformResult(dynamoResult) {
  var response = {
    item: dynamoResult.Item || dynamoResult.Attributes,
    items: dynamoResult.Items,
    numberOfItemsReturned: dynamoResult.Count,
    numberOfItemsEvaluated: dynamoResult.ScannedCount,
    lastEvaluatedKey: dynamoResult.LastEvaluatedKey,
  };
  return response;
}
