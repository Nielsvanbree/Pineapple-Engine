const Pineapple = require("../../../pineapple");
const pineappleConfig = require("../pineappleConfig/index");
const testEvent = require("../testEvents/get.json");

const payment = new Pineapple(pineappleConfig);

async function getWithVersions() {
  try {
    const { entity, lastEvaluatedKey } = await payment.dynamodb.getDynamoRecord(
      testEvent,
      true,
      10,
      undefined,
      (params) => {
        console.log("🚀 ~ file: list.js ~ line 9 ~ list ~ params", params);
        return params;
      }
    );
  
    return { entity, lastEvaluatedKey };
  } catch (error) {
    console.error("🚀 ~ file: get.js ~ line 21 ~ get ~ error", error);
    throw error;
  }
}

async function get() {
  try {
    const { entity } = await payment.dynamodb.getDynamoRecord(
      testEvent
    );
  
    return entity;
  } catch (error) {
    console.error("🚀 ~ file: get.js ~ line 21 ~ get ~ error", error);
    throw error;
  }
}

get().then(res => {
  console.log("🚀 ~ file: update.js ~ line 15 ~ update ~ res", res);
}).catch(err => {
  console.error("🚀 ~ file: update.js ~ line 17 ~ update ~ err", err);
});