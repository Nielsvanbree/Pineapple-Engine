import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfig/index";
import testEvent from "../testEvents/get.json";
import { getSchema } from "../tsModels/index";

const payment = new Pineapple(pineappleConfig);

async function getWithVersions() {
  try {
    const { entity, lastEvaluatedKey } = await payment.dynamodb.get(
      testEvent,
      true,
      10,
      undefined,
      (versions) => {
        console.log("🚀 ~ file: list.js ~ line 9 ~ list ~ params", versions);
        return versions;
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
    const input: getSchema = {
      paymentId: "payment_1c76f84a-f5ed-4212-a70f-27ff13e88e5e",
    };
    const { entity } = await payment.dynamodb.get(
      input
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