import { addNewVersion } from "../../../helpers/utils";
import { Records } from "../testEvents/dynamoStream.json";

const TABLE_NAME = "fruitful-development-pineapple-prov"; // Replace with your table name, e.g. through environment variables

async function processStreamRecords() {
  try {
    await Promise.all(Records.map(async record => {
      try {
        await processRecord(record);
      } catch (error) {
        console.log('Error on record:', record);
        console.error("module.exports.handler -> single record error -> error", error);
      }
    }));
  } catch (error) {
    console.error("🚀 ~ file: get.js ~ line 21 ~ get ~ error", error);
    throw error;
  }
}

async function processRecord(record: Record<string, any>) {
  // if (record.dynamodb.OldImage)
  //   record.dynamodb.OldImage = translateStreamImage(record.dynamodb.OldImage);

  // if (record.dynamodb.NewImage)
  //   record.dynamodb.NewImage = translateStreamImage(record.dynamodb.NewImage);

  // You should pass a translated key into addNewVersion
  const newItem = record.dynamodb.NewImage;
  const oldItem = record.dynamodb.OldImage;

  let newVersion;
  if ((record.eventName === 'INSERT' || record.eventName === 'MODIFY'))
    newVersion = await addNewVersion(newItem, { tableName: TABLE_NAME });

  return newVersion;
}

processStreamRecords().then(res => {
  console.log("🚀 ~ file: get.js ~ line 15 ~ get ~ res", res);
}).catch(err => {
  console.error("🚀 ~ file: get.js ~ line 17 ~ get ~ err", err);
});