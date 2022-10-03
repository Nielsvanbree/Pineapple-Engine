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
      'eyJwayI6InBheW1lbnRfMDFHRUNaUDg5V0ExRU44VkZFUUg1WTFOUkIiLCJzayI6InBheW1lbnRWZXJzaW9uI3ZlcnNpb25fMDFHRUNaUUJXUzhWVlBaWE5ENFNBUUVLNjkifQ=='
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
        paymentId: "payment_01GED00E511FMYEFNA95587T5N",
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