import { Pineapple } from "../../../pineapple";
import { pineappleConfig } from "../pineappleConfigs/payment/index";
import testEvent from "../testEvents/getPayment.json";

const payment = new Pineapple(pineappleConfig);

async function getWithVersions() {
  try {
    const { entity, lastEvaluatedKey, versionParams } = await payment.dynamodb.get(
      testEvent,
      {
        listVersions: true,
        limit: 1,
        exclusiveStartKey: 'eyJwayI6InBheW1lbnRfMDFHRUNaUDg5V0ExRU44VkZFUUg1WTFOUkIiLCJzayI6InBheW1lbnRWZXJzaW9uI3ZlcnNpb25fMDFHRUNaUUJXUzhWVlBaWE5ENFNBUUVLNjkifQ==',
        paramsOnly: false
      },
      {
        listVersionsCallback: (versionParams, latestVersionParams) => {
          return { versionParams, latestVersionParams };
        }
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
    const { entity, params } = await payment.dynamodb.get(
      {
        paymentId: "payment_01GECZP89WA1EN8VFEQH5Y1NRB"
      },
      { paramsOnly: false },
      {
        getCallback: (params) => {
          return params;
        }
      }
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