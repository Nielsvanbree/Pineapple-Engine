# Pineapple Engine

<i>“The pineapple is actually the result of dozens of individual fruit-producing flowers that have fused into a single fruit”</i>

Pineapple is a data first product for Serverless Cloud developers. It takes general best practices surrounding data modification and data retrieval by looking at existing software architecture design patterns and best practices from the services it uses. These best practices are then turned into generic layers so those best practices become readily available to use for a wide range of applications. Instead of needing to write code for these best practices surrounding data over and over again for each application or functionality, pineapple does this for the developer, who can then put more focus on the actual business logic. The only thing a developer has to do is configure an entity by providing a simple configuration folder that will be self documenting at the same time. Basically, Pineapple Engine is a <a target="_blank" href="https://deviq.com/design-patterns/repository-pattern">repository pattern</a> for access to Serverless data storage services.

Pineapple exists of multiple parts. The Pineapple Engine can be used to easily retrieve and modify data and currently supports DynamoDB as its source data. The data in DynamoDB is designed according to the concept of DynamoDB's single-table design. All patterns that are supported by Pineapple are part of the [Pineapple table design](#pineapple-single-table-design).

<br>

## Installation

```
npm install --save @levarne/pineapple-engine
```

## Import

**TypeScript, ES6+, etc..**
```javascript
import { Pineapple } from "@levarne/pineapple-engine";
import { pineappleConfig } from "../pineappleConfig/index";

const Entity = new Pineapple(pineappleConfig);
```

**CommonJS environments**
```javascript
const { Pineapple } = require("@levarne/pineapple-engine");
const { pineappleConfig } = require("../pineappleConfig/index");

const Entity = new Pineapple(pineappleConfig);
```

## Table of Contents
- [Pineapple Engine](#pineapple-engine)
  - [Installation](#installation)
  - [Import](#import)
  - [Table of Contents](#table-of-contents)
  - [Usage](#usage)
    - [Global config](#global-config)
    - [Mapping config](#mapping-config)
    - [Schemas](#schemas)
    - [Grouping configs together](#grouping-configs-together)
  - [Working With DynamoDB Streams](#working-with-dynamodb-streams)
  - [Pineapple Utils](#pineapple-utils)
  - [Pineapple Joi](#pineapple-joi)
  - [Pineapple single-table design](#pineapple-single-table-design)
    - [Global Secondary Indexes](#global-secondary-indexes)
    - [GSI overloading](#gsi-overloading)
    - [Composite sortkey design](#composite-sortkey-design)
    - [Adjacency list design patterns](#adjacency-list-design-patterns)
    - [ULID versionig system](#ulid-versionig-system)
  - [Attachment Entities](#attachment-entities)
  - [Future Products](#future-products)

## Usage
First, think of your entity:
- What is its name and purpose within the application?
  - E.g. <b>payment</b>, an entity that stores payments made through your application.
- What model/schema is required?
  - We use <a target="_blank" href="https://www.npmjs.com/package/joi">joi</a> inside Pineapple Engine to validate your schemas.
- What data questions do I need to ask this entity?
  - E.g. <i>"Give me a <b>list</b> of all payments that have a <b>paid status</b> and belong to company <b><a target="_blank" href="https://levarne.com/en">Levarne</a></b>"</i>

Second, try to fit your entity in the Pineapple table design by looking at the supported DynamoDB single-table design patterns. We personally like to use <a target="_blank" href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/workbench.html">NoSQL Workbench</a> at this stage for playing around with a visual representation of your table design.

Now that you have your Pineapple table design, you can start filling in the Pineapple configuration. It needs a global, mapping and schema config. Combine them all into 1 export and use it to initialize the Pineapple Engine Entity class.

### Global config
General configuration.
```typescript
// pineappleConfig/global.ts

import { iGlobalConfig } from "@levarne/pineapple-engine";
import { v4 as uuidv4 } from "uuid";

const globalConfig: iGlobalConfig = {
  entityName: "payment",
  dataSource: "dynamodb", // Currently the only supported source
  tableName: "fruitful-development-pineapple-provisioned", // Replace with your own table name
  idGeneratorFunction: uuidv4, // Optional: overwrite the automatically generated id by Pineapple Engine (we use a ULID) by your own function to generate a unique id, such as a uuid
  rootEntity: true // Terminology from domain driven design, the root entity is the entity controlling sub-entities, which we call attachment entities within Pineapple
}

export { globalConfig };
```
### Mapping config
Because the Pineapple table design uses some generic attribute names for all present keys (pk, sk, gsiPk1, gsiPk2, gsiPk3, gsiSk1) that can mean different things depending on your entity, we need a way to easily map those generic but unreadable attribute names to readable attribute names that are relevant to the entity you're working with. By filling in the mapping config according to your design, you make sure you only have to deal with readable attributes inside your function code, because Pineapple Engine takes care of the translations. Take a look at the example below for our payment entity.
```typescript
// pineappleConfig/mapping.ts

import { iMappingConfig } from "@levarne/pineapple-engine";

const mappingConfig: iMappingConfig = {
  encodedToDecodedMapping: {
    // The pk of a table is always prefixed with the value of {{ globalConfig.entityName }}
    pk: "paymentId",
    gsiPk1: "orderId",
    gsiPk2: "productId",
  },
  sortKeyConstruction: {
    // e.g. payment#version_01GEFM7AVA6Y38Y52DVC9GS488
    sk: ["entity", "version"],
    // e.g. payment#product_01GEFM9S1SGHPXFZ432A0W5PKZ#status_paid
    gsiSk1: ["entity", "productId", "status"],
  },
  queryableAttributes: ["pk", "gsiPk1", "gsiPk2", "entity"], // Because the order of the array determines the priority of the attribute when querying, this config will overwrite the global priority config -> Use this when certain patterns are more efficient than others for this entity
}

export { mappingConfig };
```

### Schemas
Schemas to validate your entity at certain points within your application. The interface schemas are used inside Pineapple Engine to validate your entity before sending your request to the table interface. These are mandatory to use inside Pineapple Engine to ensure nothing malformed is being send and better error messages can be displayed to you as a developer. Set them up carefully and take the table design into account when thinking of required fields or fields that cannot go with or without each other. The usage of other schemas than the interface schemas is up to you how to use within your Serverless setup and are here just as an example. You are also free to setup your joi schemas the way you like.
```typescript
// pineappleConfig/schemas.ts

import { isValidUlid } from "@levarne/pineapple-engine/helpers/utils";
import { j, metaInfoSchema, prefixedUlid  } from "@levarne/pineapple-engine/helpers/joi";

// Base schema for the entity, but without an id so we can create an update & create schema from here.
// This schema shouldn't contain all elements that can be created, but should only contain queryable & filterable attributes. Extend the create & update schemas with the other fields.
const baseEntitySchemaWithoutId = j
  .object()
  .keys({
    status: j
      .string()
      .valid(
        "open",
        "pending",
        "authorized",
        "failed",
        "expired",
        "canceled",
        "paid"
      ),
    productId: j
      .string()
      .regex(/^product_/)
      .custom(prefixedUlid),
    orderId: j
      .string()
      .regex(/^order_/)
      .custom(prefixedUlid),
    updatedBy: j.string(),
  })
  .unknown(false)
  .required();

// Fields that can be used during creation or update
const updateableFieldsSchema = j
  .object()
  .keys({
    userId: j.string(),
  })
  .unknown(true);

const entityIdSchema = j
  .string()
  .regex(/^payment_/)
  .custom(prefixedUlid);

// Base schema appended with the id, which is the full schema.
const baseEntitySchemaWithId = baseEntitySchemaWithoutId.append({
  paymentId: entityIdSchema,
});

// Schema should be used at: input & interface.
const createSchema = baseEntitySchemaWithoutId
  .fork(["status", "productId", "orderId"], (schema) => schema.required())
  .concat(updateableFieldsSchema);

// Schema should be used at: input & interface.
const updateSchema = baseEntitySchemaWithId
  .fork([], (schema) => schema.required())
  .concat(updateableFieldsSchema);

// Sometimes an input value should be modified by the update function, so the interface receives something different than the input Lambda
const interfaceUpdateSchema = updateSchema.fork(["paymentId"], (schema) =>
  schema.required()
);

// Sometimes an input value should be modified by the update function, so the interface receives something different than the input Lambda
const interfaceCreateSchema = createSchema.fork(["userId"], (schema) =>
  schema.required()
);

// Schema should be used at: interface.
const getSchema = baseEntitySchemaWithId
  .fork(["paymentId"], (schema) => schema.required())
  .append({
    version: [
      j.number().valid(0),
      j.string().custom((value) => {
        if (!isValidUlid(value))
          throw new Error("version is not a valid ULID");
      }),
    ],
  });

// Schema should be used at: input & interface.
const listEntitySchema = baseEntitySchemaWithoutId.fork([], (schema) =>
  schema.required()
);

// Schema should be used at: input & interface.
const listAttachmentsSchema = j.object().keys({});

// Schema should be used at: output.
// The output of an entity is always the creation schema + the automatically generated userId & meta information on creation.
const outputEntitySchema = createSchema
  .append({
    paymentId: entityIdSchema,
  })
  .concat(metaInfoSchema);

export {
  createSchema,
  updateSchema,
  getSchema,
  listEntitySchema,
  listAttachmentsSchema,
  outputEntitySchema,
  interfaceUpdateSchema,
  interfaceCreateSchema,
};
```

### Grouping configs together
To group all config files together, use an index.ts file. This grouped configuarion can then be used to initialize your Pineapple Engine Entity.
```typescript
// pineappleConfig/index.ts

import { globalConfig } from "./global";
import { mappingConfig } from "./mapping";
import * as schemas from "./schemas";

const pineappleConfig = { globalConfig, mappingConfig, schemas };

export { pineappleConfig };
```
```typescript
// yourFunction.ts
import { Pineapple } from "@levarne/pineapple-engine";
import { pineappleConfig } from "../pineappleConfig/index";

const Payment = new Pineapple(pineappleConfig);

...
// Get

const paymentParams = {
  paymentId: "payment_01GEFN3JXCG5D0R6APK0H5M9WM",
  version: 0, // 0 is used as the latest version of an object, replace with a ULID to retrieve a specific version of this object
};
const options = {
  listVersions: true, // List versions true or false
  limit: 10, // Version limit to retrieve
  exclusiveStartKey: "eyJwayI6InBheW1lbnRfMDFHRUNaUDg5V0ExRU44VkZFUUg1WTFOUkIiLCJzayI6InBheW1lbnRWZXJzaW9uI3ZlcnNpb25fMDFHRUNaUUJXUzhWVlBaWE5ENFNBUUVLNjkifQ==" // Provide an optional exclusiveStartKey for pagination
};

const { entity: payment, lastEvaluatedKey } = await Payment.dynamodb.get(
  paymentParams,
  options
);

...
// List

// Interpreted as: "give me an object that looks like this"
const listParams = {
  orderId: "order_01GECZNFYAZHJVS2C8HA7PBYSP"
};
const options = {
  limit: 10, // Optional item limit to query for
  exclusiveStartKey: undefined // Optional exclusiveStartKey
};

// The Pineapple Engine figures out what index and keys to use as query or filter attributes and always strives for the most efficient query
const { items, lastEvaluatedKey } = await Payment.dynamodb.list(
  listParams,
  options,
  (params) => {
    // Callback with the constructed params object as a value that will be send to the DynamoDB query command. You can change the object any way you like at this point and the output should always be a valid params object that the DynamoDB query command can understand.
    // Use this callback if you need any non-standard Pineapple query behaviour, such as filtering on price > 100.
    return params;
  }
);

...
// Create/Update

// According to our schema and table setup, this will create a new payment object and the paymentId will be automatically generated by the Pineapple Engine.
const updateParams = {
  status: "open",
  orderId: "order_01GED091GHEWQM4CV9NEYMJ7WN",
  productId: "product_01GECZJH68H1DG0CG7WCGZ2818",
  userId: "user_01GEFNPWNYA14CYQ4YN5H3JHEJ"
};
const options = {
  executorUsername: "user_01GEFNPWNYA14CYQ4YN5H3JHEJ" // userId that performs the update
};

const { entity: newPayment } = await Payment.dynamodb.update(
  updateParams,
  options,
  (params) => {
    // Callback with the constructed params object as a value that will be send to the DynamoDB update command. You can change the object any way you like at this point and the output should always be a valid params object that the DynamoDB update command can understand.
    // Use this callback if you need to overwrite any standard Pineapple Engine behaviour, for example to dynamically change the automatically generated paymentId if your id is dependent on any business logic.
    return params;
  }
);
```

## Working With DynamoDB Streams
Handling DynamoDB stream records with Pineapple is made very easy. To unpack a stream's newImage & oldImage, you can use the ``` Pineapple.dynamodb.unpackStreamRecord(record: DynamoDBRecord)``` method, which outputs the decoded and non-decoded variants, as well as the stream's eventName.
```typescript 
// DynamoStreamHandler.js
import { Pineapple } from "@levarne/pineapple-engine";
import { addNewVersion } from "@levarne/pineapple-engine/helpers/utils";
import { DynamoDBRecord } from "@levarne/pineapple-engine/helpers/dynamodb";
import { pineappleConfig } from "../pineappleConfig/index";
import { Records } from "../testEvents/dynamoStream.json";

const TABLE_NAME = "YOUR-TABLE-NAME"; // Replace with your table name, e.g. through environment variables

const payment = new Pineapple(pineappleConfig);

async function processStreamRecords() {
  try {
    await Promise.all(
      Records.map(async (record: any) => {
        try {
          await processRecord(record);
        } catch (error) {
          console.log("Error on record:", record);
          console.error(
            "module.exports.handler -> single record error -> error",
            error
          );
        }
      })
    );
  } catch (error) {
    console.error("🚀 ~ file: get.js ~ line 21 ~ get ~ error", error);
    throw error;
  }
}

async function processRecord(record: DynamoDBRecord) {
  const { eventName, newImage, oldImage, rawNewImage, rawOldImage } =
    payment.dynamodb.unpackStreamRecord(record);

  let newVersion;
  if (
    (record.eventName === "INSERT" || record.eventName === "MODIFY") &&
    newImage
  )
    newVersion = await addNewVersion(newImage, { tableName: TABLE_NAME });

  return newVersion;
}

processStreamRecords()
  .then((res) => {
  })
  .catch((err) => {
  });
```

## Pineapple Utils
Pineapple Engine supports a few utils that are relevant to building with Pineapple entities.
```typescript 
// Check if a value is a valid ulid, handy in your joi schemas for example
isValidUlid(value: string) => boolean

// Adds a new version for an object; use this inside a dynamo stream event when an INSERT or MODIFY event has taken place
// For an example look at the versioning section below
addNewVersion(
  newItem: Record<string, any>,
  options: { tableName: string }
) => Promise<Record<string, any>>
```

## Pineapple Joi 
Pineapple Engine heavily uses joi for validating inputs and outputs at different levels. To make your life as a developer a little easier, the Pineapple-Engine exports a few Joi helper functions that you can use when developing your Pineapple entity. 

<b>Note: since Joi enforces the usage of the same npm version across your function code, Joi is listed as a peer dependency in this project. Your Joi version and the Pineapple-Engine Joi version therefore need to match.</b>

```typescript 
// Included utilities in pineappleJoi

// The schema with automatically generated meta information, such as createdBy and version
const metaInfoSchema = j.object().keys({
  version: j.number().integer().min(0).required(),
  latestVersion: j.when("version", {
    is: 0,
    then: j.number().integer().min(1).required(),
    otherwise: j.forbidden(),
  }),
  createdBy: j.string().when("version", {
    is: 0,
    then: j.string().required(),
    otherwise: j.forbidden(),
  }),
  createdAt: j.date().iso().cast("string").required(),
  updatedAt: j.date().iso().cast("string").required(),
  updatedBy: j.string().required(),
});

// Can be used as a custom schema validation function, which validates if your value adheres to the pattern: {{anyStringValue}}_{{uuid}}
prefixedUuid(value: string) => string

// Can be used as a custom schema validation function, which validates if your value adheres to the pattern: {{anyStringValue}}_{{ulid}}
prefixedUlid(value: string) => string

// Joi exported as j
j

// An extension of j.validate(), which also displays where the validation error occurred if there was any error
// With the formatValidationError callback you can add an extra error message for better readability, which is especially useful if you validate at multiple stages
validate(
  schema: j.ObjectSchema,
  event: Record<string, any>,
  options = {},
  validatedAt = "input",
  formatValidationError?: (error: any) => string
) => any

```
```typescript 
// Example usage inside your code
import { j, validate, metaInfoSchema, prefixedUlid, prefixedUuid } from "@levarne/pineapple-engine/helpers/joi";

const paymentId = j
  .string()
  .regex(/^payment_/)
  .custom(prefixedUlid);
```

## Pineapple single-table design
We assume you're already familiar with DynamoDB's single-table design, but if not you can follow the links to the official AWS docs for more context. Now let's briefly go over some of the patterns that our Pineapple single-table design uses.

### <a target="_blank" href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-indexes.html">Global Secondary Indexes</a>
The Pineapple single-table design uses a few global secondary indexes. They are as follows:
- pk-sk (table)
- pk-gsiSk1 (index)
- gsiPk1-gsiSk1 (index)
- gsiPk2-gsiSk1 (index)
- gsiPk3-gsiSk1 (index)
- entity-gsiSk1 (index)

You can choose to leave out 1 or more indexes in your table except the <b>entity-gsiSk1 index</b> or add another index. However, if you add another index it won't be taken into account by the Pineapple Engine; you'll have to take care of that index on your own.

### <a target="_blank" href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-gsi-overloading.html">GSI overloading</a>
GSI overloading, or overloading a global secondary index, basically means that you can store many entities under the same attribute names while they have a different meaning per entity. Pineapple does this through the mapping service, which you configure in the [mapping config file](#mapping-config).

### <a target="_blank" href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-sort-keys.html">Composite sortkey design</a>
A composite sortkey design allows you to query on hierarchical relationships or query relationships with a low cardinality such as status or boolean flags, or you can place known attributes such as the entity name in it. For non-hierarchical setups, go from best known to low cardinality to high cardinality or most unknown, because the further away a part of your sortkey is, the harder it will be to query on it.
<br>
- Good example: payment#status_paid#dt_2022-10-03T20:02:17.306Z
  - Since you most likely already work within the context of a payment API, payment can go at the beginning. Status has a low cardinality with a known set of values (e.g. paid, expired, failed, open), so if you only want to query on dt and don't care about the status, you can always construct 4 separate queries (1 for each status) and query on dt in each of them.
- Bad example: payment#dt_2022-10-03T20:02:17.306Z#status_expired
  - It's a bad example because status basically becomes unqueryable since you most likely don't know the exact dt in your context when querying and dt has a high cardinality, while status has a low cardinality

<i><b>The sort keys inside the Pineapple single-table design are sk and gsiSk1. It uses sk only for the table itself (pk-sk) and gsiSk1 for all global secondary indexes.</i></b>

### <a target="_blank" href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-adjacency-graphs.html">Adjacency list design patterns</a>
To represent many-to-many relationships you can use an adjacency list design pattern. This basically means that you could store 1 or more sub entity under the same entity object. In Pineapple terminoligy we call this an entity attachment. Although attachments are still in alpha and not recommended to use, you can build this using a regular entity as well. 
<br><br>
Example: our payment entity holds information like the linked order, price paid and maybe some VAT info. Now what if we also have an entity called paymentInvoice that is always linked to a payment. In this case, we want to store the paymentInvoice as an attachment under the same partition key (pk or paymentId how we called it) of the relevant payment object.
<br>
- Payment object:
  - paymentId (pk) = payment_01GEFRE5TAQ62JJ5XRDJ2Z5FAX
  - sk = payment#version_0
- PaymentInvoice object
  - paymentId (pk) = payment_01GEFRE5TAQ62JJ5XRDJ2Z5FAX
  - sk = paymentInvoice#version_0

### ULID versionig system
The Pineapple single-table design stores your data using a versioning system supported by <a target="_blank" href="https://www.npmjs.com/package/ulid">ulid</a>. Your object always has a latest version and a list of version objects that represent your object over time, so there is always a history of each object you store in your table. The latest version of your object is marked with <b>version_0</b>. The version 0 will receive all updates through the Pineapple Engine. You will have to setup a DynamoDB stream function that generates the actual version objects for you. An example of how to achieve this can be seen below. You only have to setup this stream once per table for all entities inside that table.
<br>

We chose ulid for our versionig system because it's a unique identifier, but with an ordering of time. That means that you can list versions created between date x and y within your DynamoDB table, which would have been difficult with another setup.

```javascript
// First import the Pineapple translateStreamImage & addNewVersion functions
const { translateStreamImage } = require("@levarne/pineapple-engine/helpers/dynamodb");
const { addNewVersion } = require("@levarne/pineapple-engine/helpers/utils");

// Reference to your Pineapple table
const { TABLE_NAME } = process.env;

...

if (record.dynamodb.OldImage)
  record.dynamodb.OldImage = translateStreamImage(record.dynamodb.OldImage);

if (record.dynamodb.NewImage)
  record.dynamodb.NewImage = translateStreamImage(record.dynamodb.NewImage);

const newItem = record.dynamodb.NewImage;
const oldItem = record.dynamodb.OldImage;

// Looping over your stream records and check if it's an INSERT or MODIFY event 
// The Pineapple addNewVersion function will check if it's a version 0 and has a latestVersion of at least 1 
// You can also filter on version 0 by using DynamoDB filter patterns to reduce the amount of stream records
if ((record.eventName === 'INSERT' || record.eventName === 'MODIFY'))
    newVersion = await addNewVersion(newItem, { tableName: TABLE_NAME });
```

If everyting went well, you now have an object and a version after the creation of your entity object.

- Latest version of object
  - pk = payment_01GEFRE5TAQ62JJ5XRDJ2Z5FAX
  - sk = payment#version_0
- First version of object 
  - pk = payment_01GEFRE5TAQ62JJ5XRDJ2Z5FAX
  - sk = payment#version_01GEFSWHM36ZMC3V2C8JFZV1R3
  - Currently the exact same as version_0
  - versionNumber = 1

Now if there is another update to this payment object, the stream will create a second version:
- Second version of object 
  - pk = payment_01GEFRE5TAQ62JJ5XRDJ2Z5FAX
  - sk = payment#version_01GEFT0EPKXHZE88KR7JDE0MAE
  - Currently the exact same as version_0 (version 01GEFSWHM36ZMC3V2C8JFZV1R3 is now outdated and is still there for a history lookup if needed)
  - versionNumber = 2

## Attachment Entities
When you're working with more advanced patterns, attachment entities should be used. Think about a shopping cart where you can add multiple products. The cartInfo entity that stored information about the general cart would be the root entity, while each product record would be an entity attachment belonging to the cartInfo root entity.

Within Pineapple Engine, 1 extra configuration for an attachment entity is necessary to place within the global config: attachmentIdKeyName. This is the key of the id that uniquely identifies a certain attachment. With this extra information, the Pineapple Engine knows what to do. In the example below, a paymentMethodId is the unique identifier for the entity attachment named paymentMethod. 

```javascript
import { iGlobalConfig } from "../../../../pineapple";

const globalConfig: iGlobalConfig = {
  entityName: "paymentMethod",
  dataSource: "dynamodb",
  tableName: "fruitful-development-pineapple-prov",
  responseFormat: "V2",
  rootEntity: false,
  attachmentIdKeyName: "paymentMethodId"
}

export { globalConfig };
```

The entity attachment will be connected to the root entity through the same pk, so make sure the schema of your entity attachment matches that of the root entity you're trying to connect it too within your application. The paymentMethod schema file could look like the schema file below, where it's attached to the payment entity because paymentId is the partition key for the root entity payment.

```javascript
import { j, metaInfoSchema, prefixedUlid } from "../../../../helpers/joi";
import { isValidUlid } from "../../../../helpers/utils";

const paymentId = j
  .string()
  .regex(/^payment_/)
  .custom(prefixedUlid);
const paymentMethodId = j
  .string()
  .regex(/^paymentMethod_/)
  .custom(prefixedUlid);
const paymentMethodType = j.string().valid("card", "ideal");
const status = j.string().valid("active", "inActive");

const createSchema = j
  .object()
  .keys({
    paymentId: paymentId.required(),
    status: status.default("active"),
    paymentMethodType: paymentMethodType.required(),
  })
  .default({});

const updateSchema = j.object().keys({
  paymentId: paymentId.required(),
  paymentMethodId: paymentMethodId.required(),
  status: status.required(),
});

const getSchema = j.object().keys({
  paymentId: paymentId.required(),
  paymentMethodId: paymentMethodId.required(),
  version: [
    j.number().valid(0),
    j.string().custom((value) => {
      if (!isValidUlid(value)) throw new Error("version is not a valid ULID");
    }),
  ],
});

const listEntitySchema = j.object().keys({
  status,
  paymentMethodType,
  paymentId
});

const interfaceUpdateSchema = updateSchema.fork([], (schema) =>
  schema.required()
);

const interfaceCreateSchema = createSchema
  .fork([], (schema) => schema.required());

// Schema should be used at: output.
// The output of an entity is always the creation schema + the automatically generated userId & meta information on creation.
const outputEntitySchema = createSchema
  .append({
    paymentMethodId,
  })
  .concat(metaInfoSchema);

export {
  createSchema,
  updateSchema,
  getSchema,
  listEntitySchema,
  outputEntitySchema,
  interfaceUpdateSchema,
  interfaceCreateSchema,
};
```

## Future Products
Pineapple is currently still in development and will be extended with more products in the future. The first being a CLI to easily setup a Pineapple table and add a new backend or frontend entity with TypeScript or JavaScript. The CLI will also offer some integrations with other Cloud products to store additional data or sync existing data to, such as AWS S3 or Elasticsearch.