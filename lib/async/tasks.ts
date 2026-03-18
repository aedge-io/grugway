// import { type Err, Ok, type Result } from "../core/result.ts";
import { Ok, type Result } from "../core/result.ts";
import * as Results from "../core/results.ts";
import { Task } from "./task.ts";

/**
 * @module
 *
 * Utilities to work with collections of Task<T, E>
 *
 * @category Task#Intermediate
 */

/**
 * Use this to collect all `Ok<T>` values from an `ArrayLike<Task<T,E>>` or
 * `Iterable<Task<T, E>>` into a `Task<T[],E>`. Preserves input order.
 *
 * In case of an `Err<E>`, it immediately returns it  by resolving early.
 * The remaining tasks are Abandoned.
 *
 * Abandoned tasks continue running in the background but their results
 * are ignored. In case the provided tasks support cancellation, it's
 * possible to provide an `AbortController` via the options parameter.
 * The controller's `.abort()` method will be called upon early resolution.
 *
 * This function also works on variadic tuples and preserves the individual
 * types of the tuple members.
 *
 * @category Task#Intermediate
 *
 * @example
 * ```typescript
 * import { Task } from "./task.ts";
 * import * as Tasks from "./tasks.ts";
 * import { Result } from "../core/result.ts";
 *
 * const str = "thing" as string | TypeError;
 * const num = 5 as number | RangeError;
 * const bool = true as boolean | ReferenceError;
 *
 * const tuple = [
 *   Task.of(Result(str)),
 *   Task.of(Result(num)),
 *   Task.of(Result(bool)),
 * ] as const;
 *
 * const res: Result<
 *   readonly [string, number, boolean],
 *   TypeError | RangeError | ReferenceError
 * > = await Tasks.all(tuple);
 * ```
 */
export function all<
  P extends Readonly<ArrayLike<PromiseLike<Result<unknown, unknown>>>>,
>(
  tasks: P,
  options?: { controller: AbortController },
): Task<InferredSuccessTuple<P>, InferredFailureUnion<P>>;
export function all<T, E>(
  tasks: Readonly<Iterable<PromiseLike<Result<T, E>>>>,
  options?: { controller: AbortController },
): Task<T[], E>;
export function all(
  //deno-lint-ignore no-explicit-any
  tasks: any,
  options?: { controller: AbortController },
  //deno-lint-ignore no-explicit-any
): any {
  return Task.of(
    new Promise<Result<unknown[], unknown>>((resolve) => {
      const results: unknown[] = [];
      let total = 0;
      let completed = 0;
      let settled = false;
      let iterating = true;

      function trySettle() {
        if (settled || iterating) return;
        if (completed === total) {
          settled = true;
          resolve(Ok(results));
        }
      }

      for (const task of tasks) {
        const idx = total;
        total += 1;

        task.then((res: Result<unknown, unknown>) => {
          if (settled) return;

          if (res.isErr()) {
            settled = true;
            options?.controller?.abort();
            resolve(res);
            return;
          }

          results[idx] = res.unwrap();
          completed += 1;

          trySettle();
        });
      }

      iterating = false;
      trySettle();
    }),
  );
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
 * @category Result::Intermediate
 *
 * @example
 * ```typescript
 * import { Task } from "./task.ts";
 * import * as Tasks from "./tasks.ts";
 * import { Result } from "../core/result.ts";
 *
 * const str = "thing" as string | TypeError;
 * const num = 5 as number | RangeError;
 * const bool = true as boolean | ReferenceError;
 *
 * const tuple = [
 *   Task.of(Result(str)),
 *   Task.of(Result(num)),
 *   Task.of(Result(bool)),
 * ] as const;
 *
 * const res: Result<
 *   string | number | boolean,
 *   readonly [TypeError, RangeError, ReferenceError]
 * > = await Tasks.any(tuple);
 * ```
 */
export function any<
  P extends Readonly<ArrayLike<PromiseLike<Result<unknown, unknown>>>>,
>(
  tasks: P,
): Task<InferredSuccessUnion<P>, InferredFailureTuple<P>>;
export function any<T, E>(
  tasks: Readonly<Iterable<PromiseLike<Result<T, E>>>>,
): Task<T, E[]>;
//deno-lint-ignore no-explicit-any
export function any(tasks: any): any {
  return Task.of(Promise.all(tasks).then((res) => Results.any(res)));
}

/**
 * Use this to obtain the first resolving `Task<T, E>` from an `Iterable<PromiseLike<Result<T,E>>>` or `ArrayLike<PromiseLike<Result<T, E>>>`
 *
 * This function also works on variadic tuples and preserves the individual
 * types of the tuple members.
 *
 * In case the provided tasks support cancellation, it's possible to provide
 * an `AbortController` via the options parameter. The controller's `.abort()`
 * method will be called after the first `Task` has resolved.
 *
 * @category Tasks#Intermediate
 *
 * @example
 * ```typescript
 * import { Task } from "./task.ts";
 * import * as Tasks from "./tasks.ts";
 * import { Result } from "../core/result.ts";
 *
 * const str = "thing" as string | TypeError;
 * const num = 5 as number | RangeError;
 * const bool = true as boolean | ReferenceError;
 *
 * const tuple = [
 *   Task.of(Result(str)),
 *   Task.of(Result(num)),
 *   Task.of(Result(bool)),
 * ] as const;
 *
 * const res: Result<
 *   string | number | boolean,
 *   TypeError | RangeError | ReferenceError
 * > = await Tasks.race(tuple);
 * ```
 */
export function race<
  P extends Readonly<ArrayLike<PromiseLike<Result<unknown, unknown>>>>,
>(
  tasks: P,
  options?: { controller: AbortController },
): Task<InferredSuccessUnion<P>, InferredFailureUnion<P>>;
export function race<T, E>(
  tasks: Readonly<Iterable<PromiseLike<Result<T, E>>>>,
  options?: { controller: AbortController },
): Task<T, E> {
  const abort = () => options?.controller?.abort();
  const raced = Promise.race(tasks).finally(abort);

  return Task.of(raced);
}

/**
 * Use this to infer the encapsulated `<T>` type from a `Task<T,E>`
 *
 * @category Task::Basic
 */
export type InferredSuccessType<P> = P extends
  PromiseLike<Result<infer T, unknown>> ? T
  : never;

/**
 * Use this to infer the encapsulated `<E>` type from a `Task<T,E>`
 *
 * @category Task::Basic
 */
export type InferredFailureType<P> = P extends
  PromiseLike<Result<unknown, infer E>> ? E
  : never;

/**
 * Use this to infer the encapsulated `<T>` types from a tuple of `Task<T,E>`
 *
 * @category Task::Intermediate
 */
export type InferredSuccessTuple<
  P extends Readonly<ArrayLike<PromiseLike<Result<unknown, unknown>>>>,
> = {
  [i in keyof P]: P[i] extends PromiseLike<Result<infer T, unknown>> ? T
    : never;
};

/**
 * Use this to infer the encapsulated `<E>` types from a tuple of `Task<T,E>`
 *
 * @category Task::Intermediate
 */
export type InferredFailureTuple<
  P extends Readonly<ArrayLike<PromiseLike<Result<unknown, unknown>>>>,
> = {
  [i in keyof P]: P[i] extends PromiseLike<Result<unknown, infer E>> ? E
    : never;
};

/**
 * Use this to infer a union of all encapsulated `<T>` types from a tuple of `Task<T,E>`
 *
 * @category Task::Intermediate
 */
export type InferredSuccessUnion<
  P extends Readonly<ArrayLike<PromiseLike<Result<unknown, unknown>>>>,
> = InferredSuccessTuple<P>[number];

/**
 * Use this to infer a union of all encapsulated `<E>` types from a tuple of `Task<T,E>`
 *
 * @category Task::Intermediate
 */
export type InferredFailureUnion<
  P extends Readonly<ArrayLike<PromiseLike<Result<unknown, unknown>>>>,
> = InferredFailureTuple<P>[number];
