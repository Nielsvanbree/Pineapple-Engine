const Pineapple = require("../../../pineapple");
const pineappleConfig = require("../pineappleConfig/index");
const testEvent = require("../testEvents/update.json");

const payment = new Pineapple(pineappleConfig);

async function update() {
  try {
    const res = await payment.dynamodb.updateDynamoRecord(
      testEvent,
      "niels",
      (params) => {
        console.log("params", params);
        return params;
      }
    );
  
    return res;
  } catch (error) {
    console.error("🚀 ~ file: update.js ~ line 24 ~ update ~ error", error);
    throw error;
  }
}

update()
  .then((res) => {
    console.log("🚀 ~ file: update.js ~ line 15 ~ update ~ res", res);
  })
  .catch((err) => {
    console.error("🚀 ~ file: update.js ~ line 17 ~ update ~ err", err);
  });
