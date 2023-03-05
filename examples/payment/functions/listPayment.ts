import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfigs/payment/index";
import testEvent from "../testEvents/listPayment.json";

const payment = new Pineapple(pineappleConfig);

async function list() {
  try {
    const { items, lastEvaluatedKey } = await payment.dynamodb.list(
      testEvent,
      {
        limit: 1,
        exclusiveStartKey:
          "eyJzayI6InBheW1lbnQjdmVyc2lvbl8wIiwiZ3NpU2sxIjoicGF5bWVudCNwcm9kdWN0XzAxR0VDWkpINjhIMURHMENHN1dDR1oyODE4I2V4cGlyZWQiLCJnc2lQazEiOiJvcmRlcl8wMUdFQ1pORllBWkhKVlMyQzhIQTdQQllTUCIsInBrIjoicGF5bWVudF8wMUdFQ1pQODlXQTFFTjhWRkVRSDVZMU5SQiJ9",
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
