import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfig/index";
import testEvent from "../testEvents/list.json";

const payment = new Pineapple(pineappleConfig);

async function list() {
  try {
    const { items, lastEvaluatedKey } = await payment.dynamodb.list(
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

list().then((res) => {
  console.log('List succeeded', res);
}).catch((err) => {
  console.error("🚀 ~ file: list.js ~ line 18 ~ testje ~ err", err);
});