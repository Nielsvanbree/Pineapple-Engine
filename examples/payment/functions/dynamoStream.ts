import { Pineapple } from "../../../pineapple";
import { addNewVersion } from "../../../helpers/utils";
import { DynamoDBRecord } from "../../../helpers/dynamodb";
import { pineappleConfig } from "../pineappleConfigs/payment/index";
import { Records } from "../testEvents/dynamoStream.json";

const TABLE_NAME = "fruitful-development-pineapple-prov"; // Replace with your table name, e.g. through environment variables

const payment = new Pineapple(pineappleConfig);

async function processStreamRecords() {
  try {
    await Promise.all(
      Records.map(async (record: any) => {
        try {
          await processRecord(record);
        } catch (error) {
          console.log("Error on record:", record);
          console.error(
            "module.exports.handler -> single record error -> error",
            error
          );
        }
      })
    );
  } catch (error) {
    console.error("🚀 ~ file: get.js ~ line 21 ~ get ~ error", error);
    throw error;
  }
}

async function processRecord(record: DynamoDBRecord) {
  const { eventName, newImage, oldImage, rawNewImage, rawOldImage } =
    payment.dynamodb.unpackStreamRecord(record);

  let newVersion;
  if (
    (record.eventName === "INSERT" || record.eventName === "MODIFY") &&
    newImage
  )
    newVersion = await addNewVersion(newImage, { tableName: TABLE_NAME });

  return newVersion;
}

processStreamRecords()
  .then((res) => {
    console.log("🚀 ~ file: get.js ~ line 15 ~ get ~ res", res);
  })
  .catch((err) => {
    console.error("🚀 ~ file: get.js ~ line 17 ~ get ~ err", err);
  });
