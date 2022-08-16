const DynamoDB = require("./dynamodb/index");

class Pineapple {  
  constructor({ dataSource, tableName, entityName }) {
    if (dataSource === "dynamodb")
      this.dynamodb = new DynamoDB(tableName, entityName);
    else
      throw new Error("Unsupported data source!");
  }
}

async function update(entity) {
  const res = await entity.dynamodb.updateDynamoRecord({ paymentId: "1", eventId: "2" }, "niels", (params) => {
    console.log('params', params);
    return params;
  });
}

const payment = new Pineapple({ dataSource: "dynamodb", tableName: "Woohooo", entityName: "payment" });

const testje = update(payment).then(() => {
  console.log('sow gelukt')
}).catch((err) => {
  console.log("🚀 ~ file: pineapple.js ~ line 18 ~ testje ~ err", err);
});