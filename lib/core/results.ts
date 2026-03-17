import { Err, Ok, type Result } from "./result.ts";

/**
 * Use this to collect all `Ok<T>` values from an `Array<Result<T,E>>` or
 * `Iterable<Result<T,E>>` into an `Ok<T[]>`.
 * Upon encountring the first `Err<E>` value, this value is returned.
 *
 * This function also works on variadic tuples and preserves the individual
 * types of the tuple members.
 *
 * @category Result#Intermediate
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Result } from "./result.ts";
 * import * as Results from "./results.ts";
 *
 * const str = "thing" as string | TypeError;
 * const num = 5 as number | RangeError;
 * const bool = true as boolean | ReferenceError;
 *
 * const tuple = [ Result(str), Result(num), Result(bool) ] as const;
 *
 * const res: Result<
 *   readonly [string, number, boolean],
 *   TypeError | RangeError | ReferenceError
 * > = Results.all(tuple);
 *
 * assert(res.isOk());
 * ```
 */
export function all<R extends Readonly<ArrayLike<Result<unknown, unknown>>>>(
  results: R,
): Result<InferredOkTuple<R>, InferredErrUnion<R>>;
export function all<T, E>(
  results: Readonly<Iterable<Result<T, E>>>,
): Result<T[], E>;
//deno-lint-ignore no-explicit-any
export function all(results: any): any {
  const areOk = [];

  for (const res of results) {
    if (res.isErr()) return res;
    areOk.push(res.unwrap());
  }

  return Ok(areOk);
}

/**
 * Use this to obtain the first found `Ok<T>` from an `Array<Result<T,E>>` or
 * `Iterable<Result<T,E>>`.
 * If no `Ok<T>` value is found, the `Err<E>` values are collected into an
 * array and returned.
 *
 * This function also works on variadic tuples and preserves the individual
 * types of the tuple members.
 *
 * @category Result#Intermediate
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Result } from "./result.ts";
 * import * as Results from "./results.ts";
 *
 * const str = "thing" as string | TypeError;
 * const num = 5 as number | RangeError;
 * const bool = true as boolean | ReferenceError;
 *
 * const tuple = [ Result(str), Result(num), Result(bool) ] as const;
 *
 * const res: Result<
 *   string | number | boolean,
 *   readonly [TypeError, RangeError, ReferenceError]
 * > = Results.any(tuple);
 *
 * assert(res.isOk());
 * ```
 */
export function any<R extends Readonly<ArrayLike<Result<unknown, unknown>>>>(
  results: R,
): Result<InferredOkUnion<R>, InferredErrTuple<R>>;
export function any<T, E>(
  results: Readonly<Iterable<Result<T, E>>>,
): Result<T, E[]>;
//deno-lint-ignore no-explicit-any
export function any(results: any): any {
  const areErr = [];

  for (const res of results) {
    if (res.isOk()) return res;
    areErr.push(res.unwrap());
  }

  return Err(areErr);
}

/**
 * Use this to infer the encapsulated `Ok<T>` types from a tuple of `Result<T,E>`
 *
 * @category Result#Intermediate
 */
export type InferredOkTuple<
  R extends Readonly<ArrayLike<Result<unknown, unknown>>>,
> = {
  [i in keyof R]: R[i] extends Result<infer T, unknown> ? T : never;
};

/**
 * Use this to infer the encapsulated `Err<E>` types from a tuple of `Result<T,E>`
 *
 * @category Result#Intermediate
 */
export type InferredErrTuple<
  R extends Readonly<ArrayLike<Result<unknown, unknown>>>,
> = {
  [i in keyof R]: R[i] extends Result<unknown, infer E> ? E : never;
};

/**
 * Use this to infer a union of all encapsulated `Ok<T>` types from a tuple of `Result<T,E>`
 *
 * @category Result#Intermediate
 */
export type InferredOkUnion<
  R extends Readonly<ArrayLike<Result<unknown, unknown>>>,
> = InferredOkTuple<R>[number];

/**
 * Use this to infer a union of all encapsulated `Err<E>` types from a tuple of `Result<T,E>`
 *
 * @category Result#Intermediate
 */
export type InferredErrUnion<
  R extends Readonly<ArrayLike<Result<unknown, unknown>>>,
> = InferredErrTuple<R>[number];
