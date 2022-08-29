import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfig/index";

const payment = new Pineapple(pineappleConfig);

async function getWithVersions() {
  try {
    const { entity, lastEvaluatedKey } = await payment.dynamodb.get(
      {
        paymentId: "payment_1c76f84a-f5ed-4212-a70f-27ff13e88e5e"
      },
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
    const { entity } = await payment.dynamodb.get(
      {
        paymentId: "payment_1c76f84a-f5ed-4212-a70f-27ff13e88e5e"
      },
    );
  
    return entity;
  } catch (error) {
    console.error("🚀 ~ file: get.js ~ line 21 ~ get ~ error", error);
    throw error;
  }
}

getWithVersions().then(res => {
  console.log("🚀 ~ file: update.js ~ line 15 ~ update ~ res", res);
}).catch(err => {
  console.error("🚀 ~ file: update.js ~ line 17 ~ update ~ err", err);
});