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
