import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfigs/paymentMethod/index";
import testEventUpdate from "../testEvents/updatePaymentMethod.json";
import testEventCreate from "../testEvents/createPaymentMethod.json";

const paymentMethod = new Pineapple(pineappleConfig);

async function update() {
  try {
    const { entity: newPayment } = await paymentMethod.dynamodb.update(
      { ...testEventUpdate },
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
