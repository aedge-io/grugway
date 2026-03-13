import { Panic } from "./errors.ts";

export function assertNotNullish<T>(value: T): asserts value is NonNullable<T> {
  if (value == null) {
    throw Panic.causedBy(value, "expected non-nullish value");
  }
}
