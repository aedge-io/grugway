import { asInfallible, Err, Ok, type Result } from "../core/result.ts";

/**
 * This is the interface of the return value of {@linkcode Task.deferred}
 */
export interface DeferredTask<T, E> {
  task: Task<T, E>;
  succeed: (value: T) => void;
  fail: (error: E) => void;
}

/**
 * # Task<T, E>
 *
 * `Task<T, E>` is a composeable equivalent of `Promise<Result<T, E>>`
 *
 * It never rejects, but always resolves. Either with an `Ok<T>` or an `Err<E>`
 *
 * It implements the full interface of `Promise<Result<T, E>>` and can be used
 * as a drop-in replacement if desired.
 *
 * It supports almost the same API as {@linkcode Result} and allows for
 * the same composition patterns as {@linkcode Result}
 *
 * Furthermore, {@linkcode Tasks} exposes a few functions to ease working
 * with collections (indexed and plain `Iterable`s)
 *
 * @category Task#Basic
 */
export class Task<T, E> implements Promise<Result<T, E>> {
  readonly #promise: Promise<Result<T, E>>;

  private constructor(promise: Promise<Result<T, E>>) {
    this.#promise = promise;
  }

  /**
   * This is done to provide drop-in parity with native Promises, as some libraries
   * are (IMO needlessly) invariant over `PromiseLike` types and test for `thenability`
   * via `value instanceof Promise`
   */
  static {
    Object.setPrototypeOf(Task.prototype, Promise.prototype);
  }

  /**
   * =======================
   *   PROMISE INTERFACE
   * =======================
   */

  then<TResult1 = Result<T, E>, TResult2 = never>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      /* as in original Promise.then */
      //deno-lint-ignore no-explicit-any
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?:
      /* as in original Promise.catch */
      //deno-lint-ignore no-explicit-any
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<Result<T, E> | TResult> {
    return this.#promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<Result<T, E>> {
    return this.#promise.finally(onfinally);
  }

  /**
   * =======================
   *    TASK CONSTRUCTORS
   * =======================
   */

  /**
   * Use this to create a task from a `Result<T, E>` or
   * `PromiseLike<Result<T, E>` value
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Ok, Result, Task } from "@aedge-io/grugway";
   *
   * async function produceRes(): Promise<Result<number, TypeError>> {
   *  return Ok(42);
   * }
   *
   * const task = Task.of(produceRes());
   *
   * assert(task instanceof Promise);
   * assert(task instanceof Task);
   * ```
   */
  static of<T>(value: Ok<T> | PromiseLike<Ok<T>>): Task<T, never>;
  static of<E>(value: Err<E> | PromiseLike<Err<E>>): Task<never, E>;
  static of<T, E>(value: Result<T, E> | PromiseLike<Result<T, E>>): Task<T, E>;
  static of<T, E>(
    value: Result<T, E> | PromiseLike<Result<T, E>>,
  ): Task<T, E> {
    return new Task(Promise.resolve(value));
  }

  /**
   * Use this to create a `Task` which always succeeds with a value `<T>`
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const task: Task<number, never> = Task.succeed(42);
   * ```
   */
  static succeed<T>(value: T): Task<T, never> {
    return new Task(Promise.resolve(Ok(value)));
  }

  /**
   * Use this to create a `Task` which always fails with a value `<E>`
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const task: Task<never, number> = Task.fail(1);
   * ```
   */
  static fail<E>(error: E): Task<never, E> {
    return new Task(Promise.resolve(Err(error)));
  }

  /**
   * Use this to create a deferred `Task<T, E>` which will either succeed with
   * a value of type `<T>` or fail with a value of type `<E>`
   *
   * You have to provide the generic types explicitly, otherwise `<T, E>` will
   * be inferred as `<unknown, unknown>`
   *
   * This is mostly useful when working with push-based APIs
   *
   * @category Task#Advanced
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * class TimeoutError extends Error {}
   *
   * const { task, succeed, fail } = Task.deferred<number, TimeoutError>();
   *
   * const t1 = setTimeout(() => succeed(42), Math.random() * 1000);
   * const t2 = setTimeout(() => fail(new TimeoutError()), 500);
   *
   * await task
   *   .inspect(console.log)
   *   .inspectErr(console.error);
   *
   * clearTimeout(t1);
   * clearTimeout(t2);
   * ```
   */
  static deferred<T, E>(): DeferredTask<T, E> {
    let resolveBinding: (res: Result<T, E>) => void;
    const promise = new Promise<Result<T, E>>((resolve) => {
      resolveBinding = resolve;
    });
    const task = new Task<T, E>(promise);
    const succeed = (value: T) => resolveBinding(Ok(value));
    const fail = (error: E) => resolveBinding(Err(error));

    return { task, succeed, fail };
  }

  /**
   * Use this to create a task from a function which returns a `Result<T, E>`
   * or `PromiseLike<Result<T, E>` value.
   *
   * This function should be infallible by contract.
   *
   * Use {@linkcode Task.fromFallible} if this is not the case.
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { Ok, Result, Task } from "@aedge-io/grugway";
   *
   * async function produceRes(): Promise<Result<number, TypeError>> {
   *  return Ok(42);
   * }
   *
   * const task = Task.from(produceRes);
   * ```
   */
  static from<T, E>(
    fn: () => Result<T, E> | PromiseLike<Result<T, E>>,
  ): Task<T, E> {
    const p = new Promise<Result<T, E>>((resolve) => resolve(fn()))
      .catch(asInfallible);

    return new Task<T, E>(p);
  }

  /**
   * Use this to create a `Task<T, E>` from a `Promise<T>`.
   *
   * You have to provide an `errorMapFn` in case the promise rejects, so that
   * the type can be inferred.
   *
   * If you are certain(!) that the provided promise will never reject, you can
   * provide the {@linkcode asInfallible} helper from the core module.
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { asInfallible, Task } from "@aedge-io/grugway";
   *
   * const willBeString = Promise.resolve("42");
   *
   * const task: Task<string, never> = Task.fromPromise(
   *   willBeString,
   *   asInfallible,
   * );
   *
   * await task;
   * ```
   */
  static fromPromise<T, E>(
    promise: Promise<T>,
    errorMapFn: (reason: unknown) => E,
  ): Task<T, E> {
    return new Task<T, E>(
      promise.then((v) => Ok(v), (e) => Err(errorMapFn(e))),
    );
  }

  /**
   * Use this to construct a `Task<T, E>` from the return value of a fallible
   * function.
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * async function rand(): Promise<number> {
   *   throw new TypeError("Oops");
   * }
   *
   * function toTypeError(e: unknown): TypeError {
   *   if (e instanceof TypeError) return e;
   *   return TypeError("Unexpected error", { cause: e });
   * }
   *
   * const task: Task<number, TypeError> = Task.fromFallible(
   *   rand,
   *   toTypeError,
   * )
   * ```
   */
  static fromFallible<T, E>(
    fn: () => T | PromiseLike<T>,
    errorMapFn: (reason: unknown) => E,
  ): Task<T, E> {
    const p = new Promise<T>((resolve) => resolve(fn()))
      .then((v) => Ok(v), (e) => Err(errorMapFn(e)));

    return new Task<T, E>(p);
  }

  /**
   * Use this lift a function into a `Task` context, by composing the wrapped
   * function with a `Result` constructor and an error mapping function.
   *
   * If no constructor is provided, `Ok` is used as a default.
   *
   * This higher order function is especially useful to intergrate 3rd party
   * code into your `Task` pipelines.
   *
   * @category Task#Advanced
   *
   * @example
   * ```
   * import { Err, Ok, Result, Task } from "@aedge-io/grugway";
   *
   * async function toSpecialString(s: string): Promise<string> {
   *   if (s.length % 3 === 0) return s;
   *   throw TypeError("Not confomrming to schema");
   * }
   *
   * function toTypeError(e: unknown): TypeError {
   *   if (e instanceof TypeError) return e;
   *   return TypeError("Unexpected error", { cause: e });
   * }
   *
   * const lifted = Task.liftFallible(toSpecialString, toTypeError);
   *
   * const task: Task<string, TypeError> = Task.succeed("abcd").andThen(lifted);
   * ```
   */
  static liftFallible<Args extends unknown[], R, E, T = R>(
    fn: (...args: Args) => R | PromiseLike<R>,
    errorMapFn: (reason: unknown) => E,
    ctor: (arg: R) => Result<T, E> | PromiseLike<Result<T, E>> = Ok as (
      arg: R,
    ) => Result<T, E>,
  ): (...args: Args) => Task<T, E> {
    return function (...args: Args) {
      const p = new Promise<R>((resolve) => resolve(fn(...args)))
        .then((v) => ctor(v), (e) => Err(errorMapFn(e)));

      return new Task<T, E>(p);
    };
  }

  /**
   * ======================
   * TASK INSTANCE METHODS
   * ======================
   */

  /**
   * Use this to return the `Task` itself. Canonical identity function.
   *
   * Mostly useful for flattening or en lieu of a noop.
   *
   * This is mostly provided for compatibility with with `Result<T, E>`.
   *
   * @category Task#Basic
   */
  id(): Task<T, E> {
    return this;
  }

  /**
   * Use this to obtain a deep clone of `Task<T, E>`
   *
   * Under the hood, this uses the `structuredClone` algorithm
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Task } from "@aedge-io/grugway";
   *
   * const task = Task.succeed({ a: 1 });
   * const cloned = task.clone();
   *
   * const res = await task;
   * const clonedRes = await cloned;
   *
   * assert(res.unwrap() !== clonedRes.unwrap())
   * ```
   */
  clone(): Task<T, E> {
    return new Task(this.#promise.then((res) => res.clone()));
  }

  /**
   * Use this to asynchronously map the encapsulated value `<T>` to `<T2>`
   *
   * In case of `Err<E>`, this method short-circuits.
   * See {@linkcode Task#mapErr} for the opposite case.
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const task = Task.succeed(21).map((n) => n * 2);
   * const res = await task; // Ok(42)
   * ```
   */
  map<T2>(mapFn: (v: T) => T2 | PromiseLike<T2>): Task<T2, E> {
    return new Task(this.#promise.then(async (res) => {
      if (res.isErr()) return res;
      return Ok(await mapFn(res.unwrap()));
    }));
  }

  /**
   * Same as {@linkcode Task#map} but returns the provided `orValue` asynchronously
   * as a fallback in case of `Err<E>`
   *
   * @category Task#Intermediate
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const t1 = Task.succeed(5).mapOr((n) => n * 2, 0); // Task<number, never>
   * const t2 = Task.fail("x").mapOr((n) => n * 2, 0);  // Task<number, never>
   * ```
   */
  mapOr<T2>(
    mapFn: (v: T) => T2 | PromiseLike<T2>,
    orValue: T2 | PromiseLike<T2>,
  ): Task<T2, never> {
    return new Task(this.#promise.then(async (res) => {
      const mapped = res.isErr() ? await orValue : await mapFn(res.unwrap());
      return Ok(mapped);
    }));
  }

  /**
   * Same as {@linkcode Task#map} but applies `orFn` asynchronously to the
   * error value in case of `Err<E>`
   *
   * Use this if the fallback value is expensive to produce.
   *
   * @category Task#Intermediate
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const t1 = Task.succeed(5).mapOrElse((n) => n * 2, (e) => -1);  // Ok(10)
   * const t2 = Task.fail("x").mapOrElse((n) => n * 2, (e) => -1);   // Ok(-1)
   * ```
   */
  mapOrElse<T2>(
    mapFn: (v: T) => T2 | PromiseLike<T2>,
    orFn: (e: E) => T2 | PromiseLike<T2>,
  ): Task<T2, never> {
    return new Task(this.#promise.then(async (res) => {
      const mapped = res.isErr()
        ? await orFn(res.unwrap())
        : await mapFn(res.unwrap());
      return Ok(mapped);
    }));
  }

  /**
   * Use this to asynchronously map the encapsulated error `<E>` to `<E2>`
   *
   * In case of `Ok<T>`, this method short-circuits.
   * See {@linkcode Task#map} for the opposite case.
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const task = Task.fail(Error("oops"))
   *   .mapErr((e) => TypeError(e.message));
   *
   * const res = await task; // Err<TypeError>
   * ```
   */
  mapErr<E2>(mapFn: (v: E) => E2 | PromiseLike<E2>): Task<T, E2> {
    return new Task(this.#promise.then(async (res) => {
      if (res.isOk()) return res;
      return Err(await mapFn(res.unwrap()));
    }));
  }

  /**
   * Use this to produce a new `Task<T2, E2>` from the encapsulated
   * value `<T>`. Canonical `.flatMap()` or `.chain()` method.
   *
   * In case of `Err<E>`, this method short-circuits.
   * See {@linkcode Task#orElse} for the opposite case.
   *
   * @category Task#Intermediate
   *
   * @example
   * ```typescript
   * import { Err, Ok, Task } from "@aedge-io/grugway";
   *
   * const safeParse = async (s: string) => {
   *   const n = Number(s);
   *   return Number.isNaN(n) ? Err(TypeError("NaN")) : Ok(n);
   * };
   *
   * const t = Task.succeed("42").andThen(safeParse); // Task<number, TypeError>
   * ```
   */
  andThen<T2, E2>(
    thenFn: (v: T) => Result<T2, E2> | PromiseLike<Result<T2, E2>>,
  ): Task<T2, E | E2> {
    return new Task<T2, E | E2>(this.#promise.then((res) => {
      if (res.isErr()) return res;
      return thenFn(res.unwrap());
    }));
  }

  /**
   * Use this to produce a new `Task<T2, E2>` from the encapsulated
   * error `<E>`. Useful for recovery or error transformation.
   *
   * In case of `Ok<T>`, this method short-circuits.
   * See {@linkcode Task#andThen} for the opposite case.
   *
   * @category Task#Intermediate
   *
   * @example
   * ```typescript
   * import { Ok, Task } from "@aedge-io/grugway";
   *
   * const task = Task.fail(Error("oops"))
   *   .orElse((e) => Ok(e.message));
   *
   * const res = await task; // Ok<string>
   * ```
   */
  orElse<T2, E2>(
    elseFn: (v: E) => Result<T2, E2> | PromiseLike<Result<T2, E2>>,
  ): Task<T | T2, E2> {
    return new Task<T | T2, E2>(this.#promise.then((res) => {
      if (res.isOk()) return res;
      return elseFn(res.unwrap());
    }));
  }

  /**
   * Use this to conditionally pass-through the encapsulated value `<T>`
   * based upon the outcome of the supplied `ensureFn`.
   *
   * In case of `Err<E>`, this method short-circuits.
   *
   * In case of `Ok<T>`, the supplied `ensureFn` is called with the encapsulated
   * value `<T>` and if the return value is:
   *  - `Ok<T2>`: it is discarded and the original `Ok<T>` is returned
   *  - `Err<E2>`: `Err<E2>` is returned
   *
   * See {@linkcode Task#orEnsure} for the opposite case.
   *
   * This is equivalent to chaining:
   * `original.andThen(ensureFn).and(original)`
   *
   * |**LHS andEnsure RHS**|**RHS: Ok<T2>**|**RHS: Err<E2>**|
   * |:-------------------:|:-------------:|:--------------:|
   * |  **LHS: Ok<T>**     |     Ok<T>     |     Err<E2>    |
   * |  **LHS: Err<E>**    |     Err<E>    |     Err<E>     |
   *
   * @category Task#Advanced
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * function getPath(): Task<string, Error> { return Task.succeed("/home")};
   * function isReadableDir(path: string): Task<void, TypeError> { return Task.succeed(undefined) };
   * function getFileExtensions(path: string): Task<string[], Error> { return Task.succeed([".ts"])};
   *
   * getPath()
   *   .andEnsure(isReadableDir)
   *   .andThen(getFileExtensions)
   *   .inspect((exts: string[]) => console.log(exts))
   *   .inspectErr((err: Error | TypeError) => console.log(err))
   * ```
   */
  andEnsure<T2, E2>(
    ensureFn: (v: T) => Result<T2, E2> | PromiseLike<Result<T2, E2>>,
  ): Task<T, E | E2> {
    return new Task(this.#promise.then(async (original) => {
      if (original.isErr()) return original;
      const res = await ensureFn(original.unwrap());
      return res.and(original);
    }));
  }

  /**
   * Use this to conditionally pass-through the encapsulated value `<E>`
   * based upon the outcome of the supplied `ensureFn`.
   *
   * In case of `Ok<T>`, this method short-circuits.
   *
   * In case of `Err<E>`, the supplied `ensureFn` is called with the encapsulated
   * value `<E>` and if the return value is:
   *  - `Ok<T2>`: it is returned
   *  - `Err<T2>`: it is discarded and the original `Err<E>` is returned
   *
   * See {@linkcode Task#andEnsure} for the opposite case.
   *
   * This is equivalent to chaining:
   * `original.orElse(ensureFn).or(original)`
   *
   * |**LHS orEnsure RHS**|**RHS: Ok<T2>**|**RHS: Err<E2>**|
   * |:------------------:|:-------------:|:--------------:|
   * |  **LHS: Ok<T>**    |     Ok<T>     |     Ok<T>      |
   * |  **LHS: Err<E>**   |     Ok<T2>    |     Err<E>     |
   *
   * @category Task#Advanced
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * function getConfig(): Task<string, RangeError> { return Task.succeed("secret")};
   * function getFallback(err: RangeError): Task<string, Error> { return Task.succeed("default")};
   * function configureService(path: string): Task<void, TypeError> {return Task.succeed(undefined)};
   *
   * getConfig()
   *   .orEnsure(getFallback)
   *   .andThen(configureService)
   *   .inspect((_: void) => console.log("Done!"))
   *   .inspectErr((err: RangeError | TypeError) => console.log(err))
   * ```
   */
  orEnsure<T2, E2>(
    ensureFn: (v: E) => Result<T2, E2> | PromiseLike<Result<T2, E2>>,
  ): Task<T | T2, E> {
    return new Task(this.#promise.then(async (original) => {
      if (original.isOk()) return original;
      const res = await ensureFn(original.unwrap());
      return res.or(original);
    }));
  }

  /**
   * Use this to asynchronously zip the encapsulated values of two `Ok`
   * instances into a new `Task`
   *
   * If either side is `Err`, the respective `Err` is returned.
   *
   * |**LHS zip RHS** |**RHS: Ok<T2>**|**RHS: Err<E2>**|
   * |:--------------:|:-------------:|:--------------:|
   * | **LHS: Ok<T>** |  Ok<[T, T2]>  |     Err<E2>    |
   * | **LHS: Err<E>**|     Err<E>    |     Err<E>     |
   *
   * @category Task#Advanced
   *
   * @example
   * ```typescript
   * import { Ok, Task } from "@aedge-io/grugway";
   *
   * const task = Task.succeed(1).zip(Task.of(Ok("two")));
   * const res = await task; // Ok([1, "two"])
   * ```
   */
  zip<T2, E2>(
    rhs: Result<T2, E2> | PromiseLike<Result<T2, E2>>,
  ): Task<[T, T2], E | E2> {
    return new Task<[T, T2], E | E2>(
      this.#promise.then(async (res) => {
        return res.zip(await rhs);
      }),
    );
  }

  /**
   * Use this to perform asynchronous side-effects transparently.
   *
   * The `tapFn` receives a deep clone of the `Result<T, E>` to ensure
   * the original value cannot be mutated.
   *
   * @category Task#Intermediate
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const task = Task.succeed(42)
   *   .tap((res) => console.log("got:", res.unwrap()));
   * ```
   */
  tap(tapFn: (v: Result<T, E>) => void | PromiseLike<void>): Task<T, E> {
    return new Task(this.#promise.then(async (res) => {
      await tapFn(res.clone());
      return res;
    }));
  }

  /**
   * Use this to asynchronously inspect the encapsulated value `<T>`.
   *
   * Mainly used for debugging and logging.
   *
   * In case of `Err<E>`, this method short-circuits.
   * See {@linkcode Task#inspectErr} for the opposite case.
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const task = Task.succeed(42)
   *   .inspect((n) => console.log("value:", n));
   * ```
   */
  inspect(inspectFn: (v: T) => void | PromiseLike<void>): Task<T, E> {
    return new Task(this.#promise.then(async (res) => {
      if (res.isOk()) await inspectFn(res.unwrap());
      return res;
    }));
  }

  /**
   * Use this to asynchronously inspect the encapsulated error `<E>`.
   *
   * Mainly used for debugging and logging.
   *
   * In case of `Ok<T>`, this method short-circuits.
   * See {@linkcode Task#inspect} for the opposite case.
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { Task } from "@aedge-io/grugway";
   *
   * const task = Task.fail(Error("oops"))
   *   .inspectErr((e) => console.error("error:", e.message));
   * ```
   */
  inspectErr(inspectFn: (v: E) => void | PromiseLike<void>): Task<T, E> {
    return new Task(this.#promise.then(async (res) => {
      if (res.isErr()) await inspectFn(res.unwrap());
      return res;
    }));
  }

  /**
   * @deprecated (will be removed in 1.0.0) use {@linkcode Task#andEnsure} instead
   */
  trip<T2, E2>(
    tripFn: (v: T) => Result<T2, E2> | PromiseLike<Result<T2, E2>>,
  ): Task<T, E | E2> {
    return this.andEnsure(tripFn);
  }

  /**
   * @deprecated (will be removed in 1.0.0) use {@linkcode Task#orEnsure} instead
   */
  rise<T2, E2>(
    riseFn: (v: E) => Result<T2, E2> | PromiseLike<Result<T2, E2>>,
  ): Task<T | T2, E> {
    return this.orEnsure(riseFn);
  }

  /**
   * Use this to get the wrapped value out of an `Task<T, E>` instance
   *
   * Returns the wrapped value of type `<T>` in case of `Ok<T>` OR
   * `<E>` in case of `Err<E>`.
   *
   * In contrast to other implementations, this method NEVER throws an
   * exception
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Result, Task } from "@aedge-io/grugway";
   *
   * const ok = Result(42) as Result<number, string>;
   * const task = Task.of(ok);
   *
   * const union: number | string = await task.unwrap();
   *
   * assert(union === 42);
   * ```
   */
  async unwrap(): Promise<T | E> {
    return (await this.#promise).unwrap();
  }

  /**
   * Same as {@linkcode Task#unwrap} but returns a default value in case the
   * underlying `Result<T, E>` is an `Err<E>`
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Result, Task } from "@aedge-io/grugway";
   *
   * const err = Result(Error()) as Result<number, Error>;
   * const task = Task.of(err);
   *
   * const union: number | string = await task.unwrapOr(Promise.resolve("foo"));
   *
   * assert(union === "foo");
   * ```
   */
  async unwrapOr<T2>(orValue: T2 | PromiseLike<T2>): Promise<T | T2> {
    const res = await this.#promise;
    if (res.isOk()) return res.unwrap();
    return await orValue;
  }

  /**
   * Same as {@linkcode Task#unwrap} but returns a fallback value, which can based
   * constructed from the underlying value of type `<E>` in case of `Err<E>`
   *
   * @category Task#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Result, Task } from "@aedge-io/grugway";
   *
   * const err = Result(Error("foo")) as Result<number, Error>;
   * const task = Task.of(err);
   *
   * const union: number | string = await task.unwrapOrElse(
   *   async (err) => err.message
   * );
   *
   * assert(union === "foo");
   * ```
   */
  async unwrapOrElse<T2>(
    orFn: (e: E) => T2 | PromiseLike<T2>,
  ): Promise<T | T2> {
    const res = await this.#promise;
    if (res.isOk()) return res.unwrap();
    return await orFn(res.unwrap());
  }

  /**
   * Use this to obtain an async iterator of the encapsulated value `<T>`
   *
   * In case of failure, this method returns the empty `AsyncIteratorResult`
   *
   * @category Task#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert"
   * import { Err, Ok, Result, Task } from "@aedge-io/grugway";
   *
   * const success = Task.succeed(42);
   * const failure = Task.fail(Error());
   *
   * async function main() {
   *   const okIter = success.iter();
   *   const errIter = failure.iter();
   *
   *   let okCount = 0;
   *   let okYieldedValue = undefined;
   *
   *   for await (const v of okIter) {
   *     okCount += 1;
   *     okYieldedValue = v;
   *   }
   *
   *   let errCount = 0;
   *   let errYieldedValue = undefined;
   *
   *   for await (const v of errIter) {
   *     errCount += 1;
   *     errYieldedValue = v;
   *   }
   *
   *   assert(okCount === 1);
   *   assert(okYieldedValue === 42);
   *   assert(errCount === 0)
   *   assert(errYieldedValue === undefined);
   * }
   *
   * main().then(() => console.log("Done"));
   * ```
   */
  async *iter(): AsyncIterableIterator<T> {
    const res = await this.#promise;
    if (res.isErr()) return;
    yield res.unwrap();
  }

  /**
   * ============================
   * WELL-KNOWN SYMBOLS & METHODS
   * ============================
   */

  /**
   * Use this to get the full string tag
   * Short-hand for `Object.prototype.toString.call(task)`
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString)
   *
   * @category Task#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Task } from "@aedge-io/grugway"
   *
   * const tag = Task.succeed(42).toString();
   *
   * assert(tag === "[object grugway.Task]");
   * ```
   */
  toString(): string {
    return Object.prototype.toString.call(this);
  }

  /**
   * This well-known symbol is called by `Object.prototype.toString` to
   * obtain a string representation of a value's type
   *
   * This maybe useful for debugging or certain logs
   *
   * The [`.toString()`]{@link this#toString} method is a useful short-hand in these scenarios
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag)
   *
   * @category Task#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Task } from "@aedge-io/grugway"
   *
   * const task = Task.succeed({ a: 1, b: 2 });
   *
   * const toString = Object.prototype.toString;
   *
   * assert(toString.call(task) === "[object grugway.Task]");
   * assert(toString.call(Task) === "[object grugway.Task]");
   * ```
   */
  get [Symbol.toStringTag](): string {
    return "grugway.Task";
  }

  /**
   * In case of success AND that the encapsulated value `<T>` implements the
   * async iterator protocol, this delegates to the underlying implementation
   *
   * In all other cases, it yields the empty `AsyncIteratorResult`
   *
   * @category Task#Advanced
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<
    T extends AsyncIterable<infer U> ? U : never
  > {
    const res = await this;

    if (res.isErr()) return;

    const target = Object(res.unwrap());

    if (!target[Symbol.asyncIterator]) return;

    yield* target;
  }
}
