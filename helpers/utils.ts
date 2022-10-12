import { decodeTime } from "ulid";
import { j, validate } from "../helpers/joi";
import { TableInterface } from "../dynamodb/tableInterface";

const isValidUlid = (value: string) => {
  try {
    decodeTime(value);
    return true;
  } catch (error) {
    return false;
  }
};

async function addNewVersion(
  newItem: Record<string, any>,
  options: { tableName: string }
) {
  validate(
    j.object().keys({
      newItem: j
        .object()
        .keys({
          version: j.number().min(0).max(0).required(),
          latestVersion: j.number().min(1).required(),
        })
        .required(),
    }),
    { newItem },
    undefined,
    "interfaceInput"
  );

  const tableInterface = new TableInterface(options.tableName);

  return tableInterface.addNewVersion(newItem);
}

export { isValidUlid, addNewVersion };
