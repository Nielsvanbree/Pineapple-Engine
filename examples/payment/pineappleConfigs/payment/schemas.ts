import { j, metaInfoSchema, prefixedUlid } from "../../../../helpers/joi";
import { isValidUlid } from "../../../../helpers/utils";

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
  outputEntitySchema,
  interfaceUpdateSchema,
  interfaceCreateSchema,
};
