/**
 * The canonical runtime exception type used internally
 *
 * @internal
 * @category Core::Errors
 */
export class Panic<E> extends Error {
  override name = "grugway.Panic";
  override readonly cause?: E;
  constructor(cause?: E, msg?: string) {
    super(msg, { cause });
    this.cause = cause;
  }

  static causedBy<E>(cause?: E, msg = "Panic"): Panic<E> {
    return new Panic(cause, msg);
  }

  /**
   * Use this to narrow an `unknown` error to a `Panic<unknown>`
   *
   * @category Core::Errors
   */
  static isPanic(err: unknown): err is Panic<unknown> {
    return err != null && typeof err === "object" && err.constructor === Panic;
  }
}

/**
 * Use this to either throw `<E>` directly or wrap it in a `Panic<E>`
 * if `<E>` is not a subtype of the native `Error` type
 *
 * This can be useful in situations where:
 * - the encountered error is truly unrecoverable
 * - error handling is unfeasible
 * - this behaviour is required per some contract (e.g. middlewares)
 * - you want to emulate the behavior of `.unwrap()` from other libraries or
 *   languages
 *
 * @throws {E|Panic<E>}
 *
 * @category Core::Errors
 *
 * @example
 * ```typescript
 * import { Result } from "./result.ts";
 * import { Option } from "./option.ts";
 * import { panic } from "./errors.ts";
 *
 * function parseHex(hex: string): Result<number, TypeError> {
 *   const candidate = Number.parseInt(hex, 16);
 *   return Option.fromCoercible(candidate).okOrElse(() => TypeError());
 * }
 *
 * const res = Result("0x10f2c").andThen(parseHex);
 *
 * const value: number = res.unwrapOrElse(panic);
 * ```
 */
export function panic<E>(err?: E): never {
  if (err instanceof Error) {
    throw err;
  }
  throw Panic.causedBy(err, "Panic caused by unknown error!");
}

/**
 * Use this as `errMapFn` to indicate that a function or Promise to be lifted
 * into a Result or Task context is infallible
 *
 * If the lifted function or Promise throws an exception, the error will be
 * propagated
 *
 * @throws {Panic}
 *
 * @category Result#Intermediate
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert"
 * import { Err, Ok, Result, asInfallible } from "@aedge-io/grugway";
 *
 * //Let's re-implement `Result.from`
 *
 * const customFromImpl = <T>(fn: () => T) => Result.fromFallible(fn, asInfallible);
 * const getNumber = () => 42;
 *
 * const fromOriginal = Result.from(getNumber);
 * const fromCustom = customFromImpl(getNumber);
 *
 * assert(fromOriginal.isOk() === fromCustom.isOk());
 * ```
 */
export function asInfallible(e: unknown): never {
  throw Panic.causedBy(e, "A function you've passed as infallible panicked");
}

/**
 * Use this to cast a `unknown` value to a known type.
 *
 * This is mostly useful when integrating external, fallible code, where one
 * ought to deal with thrown exceptions (and this type is in fact documented).
 *
 * Please note, that this is unsafe and only provided for prototyping purposes
 * and experimentation.
 *
 * @category Core::Errors
 *
 * @example Lifting a fallible function
 * ```typescript
 * import { Result } from "./result.ts";
 * import { unsafeCastTo } from "./errors.ts";
 *
 * function parseHex(hex: string): number {
 *   const candidate = Number.parseInt(hex, 16);
 *
 *   if (Number.isNaN(candidate)) throw TypeError();
 *   return candidate;
 * }
 *
 * const safeParseHex = Result.liftFallible(
 *   parseHex,
 *   unsafeCastTo<TypeError>,
 * );
 *
 * const res = Result("0x10f2c").andThen(safeParseHex);
 *
 * const value: number = res.unwrapOr(0);
 * ```
 */
export function unsafeCastTo<E>(err: unknown): E {
  return err as E;
}
