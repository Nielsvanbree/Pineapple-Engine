const Pineapple = require("../../../pineapple");
const pineappleConfig = require("../pineappleConfig/index");
const testEvent = require("../testEvents/list.json");

const payment = new Pineapple(pineappleConfig);

async function list() {
  try {
    const { items, lastEvaluatedKey } = await payment.dynamodb.listDynamoRecords(
      testEvent,
      10,
      undefined,
      (params) => {
        console.log("🚀 ~ file: list.js ~ line 9 ~ list ~ params", params);
        return params;
      }
    );
  
    return { items, lastEvaluatedKey };
  } catch (error) {
    console.error("🚀 ~ file: list.js ~ line 20 ~ list ~ error", error);
    throw error;
  }
}

list(payment).then((res) => {
  console.log('Update succeeded', res);
}).catch((err) => {
  console.log("🚀 ~ file: pineapple.js ~ line 18 ~ testje ~ err", err);
});