import { DynamoDB } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocument,
  GetCommandInput,
  GetCommandOutput,
  QueryCommandInput,
  QueryCommandOutput,
  UpdateCommandInput,
  UpdateCommandOutput,
  TranslateConfig,
} from "@aws-sdk/lib-dynamodb";

const marshallOptions: {
  convertEmptyValues?: boolean;
  removeUndefinedValues?: boolean;
  convertClassInstanceToMap?: boolean;
} = {
  // Whether to automatically convert empty strings, blobs, and sets to `null`.
  convertEmptyValues: false, // false, by default.
  // Whether to remove undefined values while marshalling.
  removeUndefinedValues: false, // false, by default.
  // Whether to convert typeof object to map attribute.
  convertClassInstanceToMap: false, // false, by default.
};

const unmarshallOptions: {
  wrapNumbers?: boolean;
} = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
  wrapNumbers: false, // false, by default.
};

const translateConfig: TranslateConfig = { marshallOptions, unmarshallOptions };

const dynamoClient = new DynamoDB({ region: process.env.AWS_REGION });
const documentClient = DynamoDBDocument.from(dynamoClient, translateConfig);

async function get(params: GetCommandInput): Promise<TransformResult> {
  try {
    const dynamoResult: GetCommandOutput = await documentClient.get(params);
    return transformResult(dynamoResult);
  } catch (error) {
    const options = {
      service: {
        name: "DynamoDB",
        method: "get",
        params: params,
      },
    };
    console.log(JSON.stringify(options, null, 2));
    throw error;
  }
}

async function dynamoGetPineapple(
  TableName: string,
  pk: string,
  sk: string
): Promise<Record<string, any>> {
  const params: GetCommandInput = {
    TableName,
    Key: {
      pk,
      sk,
    },
  };

  return (await get(params)).item;
}

async function update(params: UpdateCommandInput): Promise<TransformResult> {
  const defaultParams = {
    ReturnValues: "ALL_NEW",
  };

  params = Object.assign({}, defaultParams, params);

  try {
    const dynamoResult: UpdateCommandOutput = await documentClient.update(
      params
    );
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
}

async function dynamoUpdatePineapple(
  TableName: string,
  pk: string,
  sk: string,
  newItem: boolean,
  executorId: string,
  attributes?: Record<string, any>,
  createdAttributes?: Record<string, any>,
  returnParams: boolean = false,
  sameItemCheck: boolean = true,
  newItemCheck: boolean = true,
  attributeCallback?: (key: string, value: any) => string
): Promise<UpdateCommandInput & Record<string, any>> {
  const now = new Date().toISOString();
  const params: UpdateCommandInput = {
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

  Object.entries(attributes || {}).forEach(([key, value]: [string, any]) => {
    if (value !== null && value !== undefined && value !== "") {
      let decodedKey = key;
      if (attributeCallback) decodedKey = attributeCallback(key, value);

      if (params.ExpressionAttributeNames)
        params.ExpressionAttributeNames[`#${decodedKey}`] = key;
      if (params.ExpressionAttributeValues)
        params.ExpressionAttributeValues[`:${decodedKey}`] = value;

      params.UpdateExpression += `, #${decodedKey} = :${decodedKey}`;
    }
  });

  let addedRemoveKeyword = false;
  Object.entries(attributes || {}).forEach(([key, value]) => {
    if (value === "") {
      let decodedKey = key;
      if (attributeCallback) decodedKey = attributeCallback(key, value);

      if (params.ExpressionAttributeNames)
        params.ExpressionAttributeNames[`#${decodedKey}`] = key;

      params.UpdateExpression += addedRemoveKeyword
        ? `, #${decodedKey}`
        : ` REMOVE #${decodedKey}`;
      addedRemoveKeyword = true;
    }
  });

  if (returnParams) return params;

  return (await update(params)).item;
}

async function query(params: QueryCommandInput): Promise<TransformResult> {
  try {
    const dynamoResult: QueryCommandOutput = await documentClient.query(params);
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
}

function unpackStreamRecord({
  eventName,
  dynamodb,
}: {
  eventName: "INSERT" | "MODIFY" | "REMOVE";
  dynamodb: { OldImage?: Record<string, any>; NewImage?: Record<string, any> };
}): {
  eventName: "INSERT" | "MODIFY" | "REMOVE";
  oldImage?: Record<string, any>;
  newImage?: Record<string, any>;
} {
  const { OldImage, NewImage } = dynamodb;
  let oldImage;
  let newImage;

  if (OldImage) oldImage = translateStreamImage(OldImage);
  if (NewImage) newImage = translateStreamImage(NewImage);

  return { eventName, oldImage, newImage };
}

function translateStreamImage(image: any) {
  return image;
  // return dynamodbTranslator.translateOutput(image, ItemShape);
}

// Function to strip the DynamoDB object from things like createdAt & createdBy
function stripDynamoObject(
  dynamoObject: Record<string, any>
): Record<string, any> {
  const attributesToStrip = [
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy",
    "sk",
    "gsiSk1",
  ];

  attributesToStrip.forEach((ats) => {
    if (dynamoObject[ats]) delete dynamoObject[ats];
  });

  return dynamoObject;
}

function transformResult(
  dynamoResult: GetCommandOutput & UpdateCommandOutput & QueryCommandOutput
): TransformResult {
  return {
    item: dynamoResult.Item || dynamoResult.Attributes,
    items: dynamoResult.Items || [],
    numberOfItemsReturned: dynamoResult.Count,
    numberOfItemsEvaluated: dynamoResult.ScannedCount,
    lastEvaluatedKey: dynamoResult.LastEvaluatedKey,
  };
}

type TransformResult = {
  item: any;
  items: Array<any>;
  numberOfItemsReturned: number | undefined;
  numberOfItemsEvaluated: number | undefined;
  lastEvaluatedKey: any;
};

export {
  get,
  dynamoGetPineapple,
  update,
  dynamoUpdatePineapple,
  query,
  unpackStreamRecord,
  translateStreamImage,
  stripDynamoObject,
  QueryCommandInput,
  UpdateCommandInput,
};
