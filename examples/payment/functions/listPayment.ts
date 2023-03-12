import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfigs/payment/index";
import testEvent from "../testEvents/listPayment.json";

const payment = new Pineapple(pineappleConfig);

async function list() {
  try {
    const { items, lastEvaluatedKey, params } = await payment.dynamodb.list(
      testEvent,
      {
        limit: 10,
        paramsOnly: false
      },
      (params) => {
        console.log("🚀 ~ file: list.js ~ line 9 ~ list ~ params", params);
        params.Limit = 100

        return params;
      }
    );

    return { items, lastEvaluatedKey };
  } catch (error) {
    console.error("🚀 ~ file: list.js ~ line 20 ~ list ~ error", error);
    throw error;
  }
}

list()
  .then((res) => {
    console.log("List succeeded", res);
  })
  .catch((err) => {
    console.error("🚀 ~ file: list.js ~ line 18 ~ testje ~ err", err);
  });
