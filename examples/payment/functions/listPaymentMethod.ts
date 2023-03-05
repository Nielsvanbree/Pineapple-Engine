import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfigs/paymentMethod/index";
import testEvent from "../testEvents/listPaymentMethod.json";

const paymentMethod = new Pineapple(pineappleConfig);

async function list() {
  try {
    const { items, lastEvaluatedKey } = await paymentMethod.dynamodb.list(
      testEvent,
      {
        limit: 1,
        exclusiveStartKey: "eyJwayI6InBheW1lbnRfMDFHRUNaUDg5V0ExRU44VkZFUUg1WTFOUkIiLCJzayI6InBheW1lbnRNZXRob2QjcGF5bWVudE1ldGhvZF8wMUdUU0FENjZDSFE3RFRDRDU2TU5BOFhaVyN2ZXJzaW9uXzAiLCJnc2lTazEiOiJwYXltZW50TWV0aG9kI2FjdGl2ZSJ9"
      },
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

list()
  .then((res) => {
    console.log("List succeeded", res);
  })
  .catch((err) => {
    console.error("🚀 ~ file: list.js ~ line 18 ~ testje ~ err", err);
  });
