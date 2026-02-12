export { None, Option, Options, Some } from "./core/option.ts";
export { asInfallible, Err, Ok, Result, Results } from "./core/result.ts";
export { isEitherwayPanic, Panic, panic, unsafeCastTo } from "./core/errors.ts";
export type { IOption } from "./core/option.ts";
export type { IResult } from "./core/result.ts";
export type {
  Empty,
  Fallible,
  Falsy,
  HasToJSON,
  Infallible,
  JsonRepr,
  NonNullish,
  Nullish,
  StringRepr,
  Truthy,
  ValueRepr,
} from "./core/type_utils.ts";
export * from "./async/task.ts";
export * as Tasks from "./async/tasks.ts";
export * from "./adapters/web/fetch/mod.ts";
