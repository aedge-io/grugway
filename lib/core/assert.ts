import { Panic } from "./errors.ts";
import type { NonNullish } from "./type_utils.ts";

export function assertNotNullish<T>(value: T): asserts value is NonNullish<T> {
  if (value == null) {
    throw Panic.causedBy(value, "expected non-nullish value");
  }
}
