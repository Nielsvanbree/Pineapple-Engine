import * as j from "joi";
import { isValidUlid } from "./utils";

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

function validate(
  schema: any,
  event: any,
  options = {},
  validatedAt = "input",
  formatValidationError?: (error: any) => string
) {
  let { error, value } = schema.validate(event, options);
  if (error) {
    let readableMessage;
    if (formatValidationError) readableMessage = formatValidationError(error);

    throw {
      code: "InvalidParameterException",
      message:
        error.details[0].type !== "alternatives.match"
          ? error.details[0].message
          : retrieveAlternativesErrorMessage(error),
      readableMessage,
      statusCode: 400,
      validatedAt,
    };
  }

  return value;
}

function prefixedUuid(value: string) {
  const [, uuidv4] = value.split("_");

  if (
    !/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(
      uuidv4
    )
  )
    throw new Error("the part after the prefix is not a valid uuidv4");

  return value;
}

function prefixedUlid(value: string) {
  const [, ulid] = value.split("_");

  if (!isValidUlid(ulid))
    throw new Error("the part after the prefix is not a valid ulid");

  return value;
}

function retrieveAlternativesErrorMessage(error: any) {
  let fullMessage = "";

  error.details[0].context.details.map(({ message }: { message: string }) => {
    fullMessage += `${fullMessage === "" ? "" : " OR "}${message}`;
  });

  return fullMessage;
}

export { j, metaInfoSchema, validate, prefixedUuid, prefixedUlid };
