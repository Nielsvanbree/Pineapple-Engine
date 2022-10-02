import { decodeTime } from "ulid";

const isValidUlid = (value: string) => {
  try {
    decodeTime(value);
    return true;
  } catch (error) {
    return false;
  }
};


export { isValidUlid };