import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfigs/paymentMethod/index";
import testEvent from "../testEvents/getPaymentMethod.json";

const paymentMethod = new Pineapple(pineappleConfig);

async function getWithVersions() {
  try {
    const { entity, lastEvaluatedKey, versionParams } = await paymentMethod.dynamodb.get(
      testEvent,
      {
        listVersions: true,
        limit: 2,
        exclusiveStartKey: "eyJwayI6InBheW1lbnRfMDFHRUNaUDg5V0ExRU44VkZFUUg1WTFOUkIiLCJzayI6InBheW1lbnRNZXRob2RWZXJzaW9uI3BheW1lbnRNZXRob2RfMDFHVFNCUVdLVFBLUVk4VERaSlA0V1g1NjgjdmVyc2lvbl8wMUdUU0JSOFJEREJDOENDM01aUEpGR0tFQyJ9"
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
    const { entity } = await paymentMethod.dynamodb.get(
      testEvent
    );
  
    return entity;
  } catch (error) {
    console.error("🚀 ~ file: get.js ~ line 21 ~ get ~ error", error);
    throw error;
  }
}

getWithVersions().then(res => {
  console.log("🚀 ~ file: get.js ~ line 15 ~ get ~ res", res);
}).catch(err => {
  console.error("🚀 ~ file: get.js ~ line 17 ~ get ~ err", err);
});
