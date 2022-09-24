import * as AWSXRay from "aws-xray-sdk";
import * as AWS from "aws-sdk";
import * as https from "https";

if (process.env.AWS_REGION)
  AWS.config.update({ region: process.env.AWS_REGION });

if (process.env.IS_LOCAL !== "true") {
  AWSXRay.captureAWS(AWS);
}

const agent = new https.Agent({
  keepAlive: true,
});

const documentClient: any = new AWS.DynamoDB.DocumentClient({
  httpOptions: {
    agent,
  },
});
const dynamodbTranslator = documentClient.getTranslator();

const ItemShape =
  documentClient.service.api.operations.getItem.output.members.Item;

async function get(params: any) {
  try {
    var dynamoResult = await documentClient.get(params).promise();
    return transformResult(dynamoResult);
  } catch (error) {
    var options = {
      service: {
        name: "DynamoDB",
        method: "get",
        params: params,
      },
    };
    console.log(JSON.stringify(options, null, 2));
    throw error;
  }
};
  
async function dynamoGetPineapple(TableName: string, pk: string, sk: string) {
  const params = {
    TableName,
    Key: {
      pk,
      sk,
    },
  };

  return (await get(params)).item;
};

async function update(params: any) {
  const defaultParams = {
    ReturnValues: "ALL_NEW",
  };

  params = Object.assign({}, defaultParams, params);

  try {
    const dynamoResult = await documentClient.update(params).promise();
    return transformResult(dynamoResult);
  } catch (error) {
    const options = {
      service: {
        name: "DynamoDB",
        method: "update",
        params: params,
      },
    };

    console.log(JSON.stringify(options, null, 2));
    throw error;
  }
};

async function dynamoUpdatePineapple(
  TableName: string,
  pk: string,
  sk: string,
  newItem: boolean,
  executorId: string,
  attributes?: any,
  createdAttributes?: any,
  returnParams = false,
  sameItemCheck = true,
  newItemCheck = true,
  attributeCallback?: (key: string, value: any) => any
) {
  const now = new Date().toISOString();
  let params: any = {
    TableName,
    Key: {
      pk,
      sk,
    },
    ExpressionAttributeNames: {
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
      "#latestVersion": "latestVersion",
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
      createdAt: now,
      createdBy: executorId,
    };
    if (newItemCheck)
      params.ConditionExpression =
        "attribute_not_exists(pk) AND attribute_not_exists(sk)";
  } else if (!newItem && sameItemCheck)
    params.ConditionExpression =
      "attribute_exists(pk) AND attribute_exists(sk)";

  Object.entries(attributes).forEach(([key, value]: [string, any]) => {
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

  return (await update(params)).item;
};

async function query(params: any) {
  try {
    const dynamoResult = await documentClient.query(params).promise();
    return transformResult(dynamoResult);
  } catch (error) {
    const options = {
      service: {
        name: "DynamoDB",
        method: "query",
        params: params,
      },
    };
    
    console.log(JSON.stringify(options, null, 2));
    throw error;
  }
};

function unpackStreamRecord({ eventName, dynamodb }: { eventName: "INSERT" | "MODIFY" | "REMOVE", dynamodb: { OldImage: any, NewImage: any } }) {
  const { OldImage, NewImage } = dynamodb;
  let oldImage;
  let newImage;

  if (OldImage) oldImage = translateStreamImage(OldImage);
  if (NewImage) newImage = translateStreamImage(NewImage);

  return { eventName, oldImage, newImage };
};

function translateStreamImage(image: any) {
  return dynamodbTranslator.translateOutput(image, ItemShape);
};

// Function to strip the DynamoDB object from things like createdAt & createdBy
function stripDynamoObject(dynamoObject: any) {
  const attributesToStrip = [
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy",
    "sk",
    "gsiSk1"
  ];

  attributesToStrip.forEach((ats) => {
    if (dynamoObject[ats]) delete dynamoObject[ats];
  });

  return dynamoObject;
};

async function transformResult(dynamoResult: any) {
  var response = {
    item: dynamoResult.Item || dynamoResult.Attributes,
    items: dynamoResult.Items,
    numberOfItemsReturned: dynamoResult.Count,
    numberOfItemsEvaluated: dynamoResult.ScannedCount,
    lastEvaluatedKey: dynamoResult.LastEvaluatedKey,
  };
  return response;
};

export {
  get, 
  dynamoGetPineapple,
  update,
  dynamoUpdatePineapple,
  query,
  unpackStreamRecord,
  translateStreamImage,
  stripDynamoObject
}