import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfigs/payment/index";
import testEventUpdate from "../testEvents/update.json";
import testEventCreate from "../testEvents/create.json";

const payment = new Pineapple(pineappleConfig);

async function update() {
  try {
    const { entity: newPayment } = await payment.dynamodb.update(
      { ...testEventUpdate, userId: "Nielseyo" },
      { executorUsername: "Nielsinho" },
      (params) => {
        console.log("params", params);

        return params;
      }
    );
  
    return newPayment;
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
