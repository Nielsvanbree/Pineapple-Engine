import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfig/index";
import testEvent from "../testEvents/get.json";

const payment = new Pineapple(pineappleConfig);

async function getWithVersions() {
  try {
    const { entity, lastEvaluatedKey } = await payment.dynamodb.get(
      testEvent,
      true,
      1,
      "eyJwayI6InBheW1lbnRfYTBhY2FiNzQtYzA4Ni00NmU5LTllZGUtNmJmYWI4ZTdlOWQ4Iiwic2siOiJwYXltZW50VmVyc2lvbiN2ZXJzaW9uXzAxR0VDVlZQVE43UkhCRTJQSERQNUpQM1lQIn0="
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
        paymentId: "payment_a0acab74-c086-46e9-9ede-6bfab8e7e9d8",
      },
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