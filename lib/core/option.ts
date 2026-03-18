//deno-lint-ignore-file no-unused-vars
/**
 * NOTE: the "no-unused-vars" lint rule is ignored in order to ensure
 * method parameter names are symetrical
 */
import type {
  Empty,
  Infallible,
  JsonRepr,
  NonNullish,
  Nullish,
  StringRepr,
  Truthy,
  ValueRepr,
} from "./type_utils.ts";
import {
  EMPTY,
  hasToJSON,
  isInfallible,
  isNotNullish,
  isPrimitive,
  isTruthy,
} from "./type_utils.ts";
import { Err, Ok, type Result } from "./result.ts";
import { assertNotNullish } from "./assert.ts";

/*
 ********************************************************************
 * base interface
 ********************************************************************
 */

interface IOption<T> {
  /**
   * Type predicate - use this to narrow an `Option<T>` to `Some<T>`
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const opt = Option.from("something" as string | undefined);
   *
   * if (opt.isSome()) {
   *   const str: string = opt.unwrap(); // narrowed to Some<string>
   *   assert(str === "something");
   * }
   * ```
   */
  isSome(): this is Some<T>;

  /**
   * Type predicate - use this to narrow an `Option<T>` to `None`
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const opt = Option.from("something" as string | undefined);
   *
   * if (opt.isNone()) {
   *   // opt is narrowed to None here
   *   assert(opt.unwrap() === undefined);
   * }
   *
   * // after the guard, opt is narrowed to Some<string>
   * ```
   */
  isNone(): this is None;

  /**
   * Use this to return the Option itself
   *
   * Canonical identity function
   *
   * Mainly useful for flattening types of `Option<Option<T>>` togehter
   * with `.andThen()`,
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const nested = Some(Option.from("something"));
   * const nestedNone = Some(None);
   *
   * const flattened = nested.andThen(o => o.id());
   * const none = nestedNone.andThen(o => o.id());
   *
   * assert(flattened.isSome() === true);
   * assert(flattened.unwrap() === "something");
   * assert(none.isNone() === true);
   * assert(none.unwrap() === undefined);
   * ```
   */
  id(): Option<T>;

  /**
   * Use this to obtain a deep clone of `Option<T>`
   *
   * Under the hood, this uses the `structuredClone` algorithm exposed via
   * the global function of the same name. Primitives are returned by value
   *
   * May incur performance penalties, depending on the platform, size and type
   * of the data to be cloned
   *
   * Can be handy if user-defined operations on reference types mutate the
   * passed value and the original value should be retained
   *
   * CAUTION: Mutations in a chained series of operations are strongly
   * discouraged
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone)
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const rec = { a: 1, b: 2 };
   * const original = Option.from(rec);
   * const cloned = original.clone();
   *
   * if (original.isSome() && cloned.isSome()) {
   *   assert(original.unwrap() === rec);   // same reference
   *   assert(cloned.unwrap() !== rec);      // different reference
   *   assert(cloned.unwrap().a === rec.a);  // same values
   * }
   * ```
   */
  clone(options?: StructuredSerializeOptions): Option<T>;

  /**
   * Use this to transform `Some<T>` to `Some<U>` by applying the supplied
   * `mapFn` to the  wrapped value of type `<T>`
   *
   * Produces a new instance of `Some`
   *
   * In case of `None`, this method short-circuits and returns `None`
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const toUpperCase = (s: string) => s.toUpperCase();
   * const some = Some("something");
   * const none = None;
   *
   * const someUppercased = some.map(toUpperCase);
   * const stillNone = none.map(toUpperCase);
   *
   * assert(someUppercased.isSome() === true);
   * assert(stillNone.isNone() === true);
   * assert(someUppercased.unwrap() === "SOMETHING");
   * ```
   */
  map<U>(mapFn: (arg: Readonly<T>) => NonNullish<U>): Option<NonNullish<U>>;

  /**
   * Same as `.map()`, but in case of `None`, a new instance of `Some` wrapping
   * the provided `orValue` of type `<U>` will be returned
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const toUpperCase = (s: string) => s.toUpperCase();
   * const orValue = "SOMETHING";
   * const some = Some("something");
   * const none = None;
   *
   * const someUppercased = some.mapOr(toUpperCase, orValue);
   * const someOrValue = none.mapOr(toUpperCase, orValue);
   *
   * assert(someUppercased.isSome() === true);
   * assert(someOrValue.isSome() === true);
   * assert(someUppercased.unwrap() === "SOMETHING");
   * assert(someOrValue.unwrap() === "SOMETHING");
   * ```
   */
  mapOr<U>(
    mapFn: (arg: Readonly<T>) => NonNullish<U>,
    orValue: NonNullish<U>,
  ): Some<NonNullish<U>>;

  /**
   * Same as `.map()`, but in case of `None`, a new instance of `Some` wrapping
   * the return value of the provided `elseFn` will be returned
   *
   * Use this if the fallback value is expensive to produce
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const toUpperCase = (s: string) => s.toUpperCase();
   * const elseFn = () => "SOMETHING";
   * const some = Some("something");
   * const none = None;
   *
   * const someUppercased = some.mapOrElse(toUpperCase, elseFn);
   * const someDefault = none.mapOrElse(toUpperCase, elseFn);
   *
   * assert(someUppercased.isSome() === true);
   * assert(someDefault.isSome() === true);
   * assert(someUppercased.unwrap() === "SOMETHING");
   * assert(someDefault.unwrap() === "SOMETHING");
   * ```
   */
  mapOrElse<U>(
    mapFn: (arg: Readonly<T>) => NonNullish<U>,
    elseFn: () => NonNullish<U>,
  ): Some<NonNullish<U>>;

  /**
   * Use this to refine a wrapped value `<T>` to `<U>` or cheaply convert
   * an instance of `Some<T>` to `None` in case the wrapped fails the supplied
   * predicate function
   *
   * In case of `None`, this method short-circuits and returns `None`
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const numOrStr = 0 as string | number;
   * const isNum = (value: unknown): value is number => typeof value === "number";
   *
   * const none = Option.fromCoercible(numOrStr); //Option<number | string>
   * const same = none.filter(isNum);             //Option<number>
   *
   * assert(same === none);
   * ```
   */
  filter<U extends T>(predicate: (arg: Readonly<T>) => arg is U): Option<U>;
  filter(predicate: (arg: Readonly<T>) => boolean): Option<T>;

  /**
   * Use this to produce a new `Option` instance from the wrapped value or
   * flatten a nested `Option`
   *
   * Given `Some<T>`, applies the supplied `thenFn` to the wrapped value of
   * type `<T>`, which produces a new `Option<U>`
   *
   * In case of `None`, this method short-circuits and returns `None`
   *
   * This is equivalent to the canonical `.flatMap()` method in traditional
   * functional idioms, thus it can be used to flatten instances of
   * `Option<Option<T>>` to `Option<T>`
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * function greaterThanTen(n: number): Option<number> {
   *   return n > 10 ? Some(n) : None;
   * }
   *
   * const some = Option(100).andThen(greaterThanTen);
   * const none = Option(5).andThen(greaterThanTen);
   *
   * assert(some.isSome() === true);
   * assert(some.unwrap() === 100);
   * assert(none.isNone() === true);
   * ```
   */
  andThen<U>(thenFn: (arg: Readonly<T>) => Option<U>): Option<U>;

  /**
   * Use this if you want to recover from `None` or lazily initialize a
   * fallback `Option<U>` in case of `None`
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * function fallback() {
   *   return Some("EXPENSIVE TO PRODUCE");
   * }
   * function expensiveGeneration(s: string): Option<string> {
   *   if (s.length !== 42) return None;
   *   return Some(s.toUpperCase());
   * }
   * const someStr = Some("thing");
   *
   * const maybeExpensive = someStr
   *   .andThen(expensiveGeneration)
   *   .orElse(fallback);
   *
   * assert(maybeExpensive.isSome() === true);
   * assert(maybeExpensive.unwrap() === "EXPENSIVE TO PRODUCE");
   * ```
   */
  orElse<U>(elseFn: () => Option<U>): Some<T> | Option<U>;

  /**
   * Use this to get the wrapped value out of an `Option` instance
   *
   * Returns the wrapped value of type `<T>` in case of `Some<T>` OR
   * `undefined` in case of `None`
   *
   * It is necessary, to narrow an instance of `Option<T>` to `Some<T>`
   * in order to narrow the return value of `.unwrap()`
   *
   * In contrast to other implementations, this method NEVER throws an
   * exception
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const some = Some("thing");
   * const none = None;
   *
   * assert(some.unwrap() === "thing");
   * assert(none.unwrap() === undefined);
   * ```
   */
  unwrap(): T | undefined;

  /**
   * Same as `.unwrap()`, but with a fallback value
   *
   * Returns the wrapped value of type `<T>` or returns a fallback value of
   * type `<U>` in case of `None`
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const orValue = "some";
   * const none = None;
   * const some = Some("thing");
   *
   * const res = none.unwrapOr(orValue) + some.unwrapOr(orValue);
   *
   * assert(res === "something");
   * ```
   */
  unwrapOr<U>(orValue: NonNullish<U>): T | NonNullish<U>;

  /**
   * Same as `.unwrap()`, but with a fallback function
   *
   * Returns the value of type `<T>` or lazily produces a value of type `<U>` in
   * case of `None`
   *
   * Use this if the fallback value is expensive to produce
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const elseFn = () => "some";
   * const none = None;
   * const some = Some("thing");
   *
   * const res = none.unwrapOrElse(elseFn) + some.unwrapOrElse(elseFn);
   *
   * assert(res === "something");
   * ```
   */
  unwrapOrElse<U>(elseFn: () => NonNullish<U>): T | NonNullish<U>;

  /**
   * Use this to transform an `Option<T>` into a Result<T, E> by providing
   * a possible Error value in case of `None`
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   * import { Result } from "./result.ts";
   *
   * const typeError = new TypeError("Something went wrong!");
   * const opt = Option.fromCoercible("");
   *
   * const res: Result<string, TypeError> = opt.okOr(typeError);
   *
   * assert(res.isErr() === true);
   * ```
   */
  okOr<E>(err: E): Result<T, E>;

  /**
   * Use this to transform an `Option<T>` into a `Result<T, E>` by providing
   * a function to lazily produce a possible Error value in case of `None`
   *
   * This is mostly useful if the Error value is expensive to produce
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   * import { Result } from "./result.ts";
   *
   * const opt = Option.fromCoercible("");
   *
   * const res = opt.okOrElse(() => new TypeError("Something went wrong!"));
   *
   * assert(res.isErr() === true);
   * ```
   */
  okOrElse<E>(err: () => E): Result<T, E>;

  /**
   * Use this to transform an `Option<T>` into a type of your choosing
   *
   * This is mostly useful for shoving an `Option<T>` into an async context.
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const some = Option(42);
   *
   * const maybeInt = some.into(s => Promise.resolve(s.unwrap()));
   *
   * maybeInt.then((x) => assert(x === 42));
   * ```
   */
  into<U>(intoFn: (arg: Option<T>) => U): U;

  /**
   * Use this to produce a tuple from two wrapped values if both are `Some`,
   * otherwise return `None`
   *
   * Apart from creating tuples, this is mostly useful for composing arguments,
   * which should be applied to a function down the line
   *
   * |  LHS `x` RHS  | RHS: Some<U> |  RHS: None  |
   * |---------------|--------------|-------------|
   * |  LHS: Some<T> | Some<[T, U]> |     None    |
   * |  LHS:  None   |     None     |     None    |
   *
   * @category Option#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * type LogArgs = [boolean, string];
   * function produceLogEntry(args: LogArgs): Option<Record<string, string>> {
   *   return Option({
   *       lvl: args[0] ? "debug" : "info",
   *       msg: args[1],
   *   });
   * }
   *
   * const debug = Some(true);
   * const logMsg = Some("I am here!");
   * const none = Option.fromCoercible("");
   *
   * const maybeLogEntry = debug.zip(logMsg).andThen(produceLogEntry);
   * const stillNone = debug.zip(none).andThen(produceLogEntry);
   *
   * assert(maybeLogEntry.isSome() === true);
   * assert(stillNone.isNone() === true);
   * ```
   */
  zip<U>(rhs: Option<U>): Option<[T, U]>;

  /**
   * Use this to conditionally pass-through the encapsulated value of
   * type `<T>` based upon the outcome of the supplied ensureFn`
   *
   * In case of `None` this method short-circuits and returns `None`
   *
   * In case of `Some<T>`, the provided `ensureFn` gets called with a value
   * of type `<T>` and if the return value is:
   *  - `Some<U>`: it is discarded and the original `Some<T>` is returned
   *  - `None`: `None` is returned
   *
   * This is equivalent to chaining:
   * `original.andThen(ensureFn).and(original)`
   *
   * | LHS `ensure` RHS | RHS: Some<U> |  RHS: None  |
   * |----------------|--------------|-------------|
   * |  LHS: Some<T>  |    Some<T>   |     None    |
   * |  LHS:  None    |      None    |     None    |
   *
   * @category Option#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * function isPositive(n: number): Option<true> {
   *   return n > 0 ? Some(true as const) : None;
   * }
   *
   * const pos = Some(42).andEnsure(isPositive);   // Some(42)
   * const neg = Some(-1).andEnsure(isPositive);   // None
   *
   * assert(pos.isSome() === true);
   * assert(pos.unwrap() === 42);
   * assert(neg.isNone() === true);
   * ```
   */
  andEnsure<U>(ensureFn: (value: T) => Option<U>): Option<T>;

  /**
   * Logical AND ( && )
   * Returns RHS if LHS is `Some<T>`
   *
   * |  LHS `&&` RHS  | RHS: Some<U> |  RHS: None  |
   * |----------------|--------------|-------------|
   * |  LHS: Some<T>  |    Some<U>   |     None    |
   * |  LHS:  None    |      None    |     None    |
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const some = Some("a");
   * const other = Some("b");
   *
   * assert(some.and(other).unwrap() === "b");  // returns RHS
   * assert(None.and(some).isNone() === true);   // short-circuits
   * ```
   */
  and<U>(rhs: Option<U>): Some<T> | Some<U> | None;

  /**
   * Logical OR ( || )
   * Returns LHS if LHS is `Some<T>`, otherwise returns RHS
   *
   * |  LHS `||` RHS  | RHS: Some<U> |  RHS: None  |
   * |----------------|--------------|-------------|
   * |  LHS: Some<T>  |    Some<T>   |   Some<T>   |
   * |  LHS:  None    |    Some<U>   |    None     |
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const maybe = Option.from(undefined);
   * const fallback = Option.from("default");
   *
   * const res = maybe.or(fallback).unwrap();
   *
   * assert(res === "default");
   * ```
   */
  or<U>(rhs: Option<U>): Some<T> | Some<U> | None;

  /**
   * Logical XOR ( ^ )
   * Useful when only one of two values should be `Some`, but not both
   * Returns `Some`, if only LHS or RHS is `Some`
   *
   * |  LHS `^` RHS   | RHS: Some<U> |  RHS: None  |
   * |----------------|--------------|-------------|
   * |  LHS: Some<T>  |     None     |    Some<T>  |
   * |  LHS:  None    |    Some<U>   |     None    |
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const a = Some(1);
   * const b = Some(2);
   *
   * assert(a.xor(None).unwrap() === 1);   // one is Some  -> Some
   * assert(None.xor(a).unwrap() === 1);    // one is Some  -> Some
   * assert(a.xor(b).isNone() === true);    // both are Some -> None
   * assert(None.xor(None).isNone() === true); // both None -> None
   * ```
   */
  xor<U>(rhs: Option<U>): Some<T> | Some<U> | None;

  /**
   * Use this to perform side-effects transparently
   *
   * The `tapFn` receives a deep clone of `Option<T>` {@linkcode IOption#clone}
   *
   * This may have performance implications, dependending on the size of
   * the wrapped value `<T>`, but ensures that the `tapFn` can never
   * change or invalidate the state of the `Option<T>` instance
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone)
   *
   * @category Option#Intermediate
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * let logged = false;
   * const some = Some("thing");
   *
   * const same = some.tap((opt) => { logged = opt.isSome(); });
   *
   * assert(same === some);  // returns the original instance
   * assert(logged); // side-effect was performed
   * ```
   */
  tap(tapFn: (arg: Option<T>) => void): Option<T>;

  /**
   * Use this to inspect the value inside an instance of `Some<T>`
   * in a transparent manner
   *
   * Short-curcuits in case of `None'
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * function toEven(n: number): Option<number> {
   *   if (n % 2 === 0) return Some(n);
   *   return None;
   * }
   *
   * const maybeEven = Option.from("thing")
   *                    .map(str => str.length)
   *                    .inspect(console.log)
   *                    .andThen(toEven);
   *
   * assert(maybeEven.isNone() === true);
   * ```
   */
  inspect(inspectFn: (value: T) => void): Option<T>;

  /**
   * Use this to get the full string tag
   * Short-hand for `Object.prototype.toString.call(option)`
   *
   * @category Option#Basic
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const someTag = Some("thing").toTag();
   * const noneTag = None.toTag();
   *
   * assert(someTag === "[object grugway.Option.Some<thing>]");
   * assert(noneTag === "[object grugway.Option.None]");
   * ```
   */
  toTag(): string;

  /**
   * Delegates to the implementation of the wrapped value `<T>` or returns
   * a deep copy of the value itself, if no implementation is present
   *
   * Returns `undefined` in case of `None`
   *
   * See the [`reference`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#description)
   *
   * @category Option#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const someNum = Some(1);
   * const none = None;
   * const rec = { a: someNum, b: none };
   * const arr = [someNum, none];
   *
   * const encode = JSON.stringify;
   *
   * assert(encode(someNum) === "1");
   * assert(encode(none) === undefined);
   * assert(encode(rec) === encode({ a: 1 }));
   * assert(encode(arr) === encode([1, null]));
   * ```
   */
  toJSON(): JsonRepr<T>;

  /**
   * Delegates to the implementation of the wrapped value `<T>` or returns
   * the empty string (i.e. `""`) in case of `None`
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString)
   *
   * @category Option#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const arr = [1];
   * const someArr = Some(arr);
   * const someStr = Some("abc");
   * const empty = None;
   *
   * assert(arr.toString() === "1");
   * assert(someArr.toString() === "1");
   * assert(someStr.toString() === "abc");
   * assert(empty.toString() === "");
   * assert(String(arr) === String(someArr));
   * ```
   */
  toString(): StringRepr<T>;

  /**
   * Delegates to the implementation of the wrapped value `<T>` or returns
   * 0 in case of `None`
   *
   * Be aware that there exists an asymmetry between `Some<T>` and `None`
   * for all types except `<number>` if `<T>` doesn't implement `.valueOf()`
   * for number coercion.
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/valueOf)
   *
   * @category Option#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const num = Some(1);
   * const numStr = Some("1");
   * const str = Some("abc");
   * const zero = None;
   *
   * assert(num.valueOf() === 1);
   * assert(zero.valueOf() === 0);
   * assert(numStr.valueOf() === "1");
   * assert(Number(numStr) === 1);
   * assert(Number.isNaN(Number("abc")));
   * assert(Number.isNaN(Number(str)));
   * ```
   */
  valueOf(): ValueRepr<T>;

  /**
   * Use this to obtain an iterator over the wrapped value `<T>`
   *
   * In case of `None`, an empty iterator is returned
   *
   * @category Option#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const some = Some(42);
   * const iter = some.iter();
   *
   * assert(iter.next().value === 42);
   * assert(iter.next().done === true);
   *
   * const none = None;
   * assert(none.iter().next().done === true);
   * ```
   */
  iter(): IterableIterator<T>;

  /**
   * Delegates to the implementation of the wrapped value `<T>` or exhausts
   * the iterator by returning `{ done: true, value: undefined }` if `<T>` doesn't
   * implement the iterator protocol
   *
   * `None` represents the empty iterator and returns the empty iterator result
   * `{ done: true, value: undefined }`
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator)
   *
   * @category Option#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const someArr = Some([1, 2, 3]);
   * const none = None;
   *
   * assert(JSON.stringify([...someArr]) === "[1,2,3]");
   * assert([...none].length === 0);
   * ```
   */
  [Symbol.iterator](): IterableIterator<
    T extends Iterable<infer U> ? U : never
  >;

  /**
   * Delegates to the implementation of the wrapped value `<T>` or returns
   * `<T>` if it already is a primitive value
   *
   * This method *ALWAYS* returns a primitive value, as required by the spec
   * In case of keyed/indexed collection types, if no primitive conversion
   * is defined, their `string` representation will be returned (i.e.
   * `collection.toString()`)
   *
   * In case of `None` the spec required hints produce the following values:
   *  - "string" -> ""
   *  - "number" -> 0
   *  - "default"? -> false
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#primitive_coercion)
   *
   * @category Option#Advanced
   */
  [Symbol.toPrimitive](hint?: string): string | number | boolean | symbol;

  /**
   * This well-known symbol is called by `Object.prototype.toString` to
   * obtain a string representation of a value's type
   *
   * This maybe useful for debugging or certain logs
   *
   * The [`.toTag()`]{@link this#toTag} method is a useful short-hand in these scenarios
   *
   * See the [reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag)
   *
   * @category Option#Advanced
   *
   * @example
   * ```typescript
   * import { assert } from "@std/assert";
   * import { Option, None, Some } from "./option.ts";
   *
   * const rec = Some({ a: 1, b: 2 });
   * const str = Some("abc");
   * const none = None;
   *
   * const toString = Object.prototype.toString;
   *
   * assert(toString.call(rec) === "[object grugway.Option.Some<[object Object]>]");
   * assert(toString.call(str) === "[object grugway.Option.Some<abc>]");
   * assert(toString.call(none) === "[object grugway.Option.None]");
   * assert(toString.call(Option) === "[object grugway.Option]");
   * assert(toString.call(Some) === "[object grugway.Option.Some]");
   * assert(toString.call(None) === "[object grugway.Option.None]");
   * ```
   */
  [Symbol.toStringTag]: string;
}

/*
 ********************************************************************
 * implementation
 ********************************************************************
 */

// By declaring an unused, generic type parameter, we get a nicer alias.
class _None<T = never> implements IOption<never> {
  isSome(): this is Some<never> {
    return false;
  }
  isNone(): this is None {
    return true;
  }
  id(): None {
    return this;
  }
  clone(options?: StructuredSerializeOptions): None {
    return this;
  }
  map<U>(mapFn: (arg: never) => NonNullish<U>): None {
    return this;
  }
  mapOr<U>(
    mapFn: (arg: never) => NonNullish<U>,
    orValue: NonNullish<U>,
  ): Some<NonNullish<U>> {
    return Some(orValue);
  }
  mapOrElse<U>(
    mapFn: (arg: never) => NonNullish<U>,
    elseFn: () => NonNullish<U>,
  ): Some<NonNullish<U>> {
    return Some(elseFn());
  }
  filter(predicate: (arg: never) => boolean): None {
    return this;
  }
  zip<U>(rhs: Option<U>): None {
    return this;
  }
  andThen<U>(thenFn: (arg: never) => Option<U>): None {
    return this;
  }
  orElse<U>(elseFn: () => Option<U>): Option<U> {
    return elseFn();
  }
  unwrap(): undefined {
    return undefined;
  }
  unwrapOr<U>(orValue: NonNullish<U>): NonNullish<U> {
    return orValue;
  }
  unwrapOrElse<U>(elseFn: () => NonNullish<U>): NonNullish<U> {
    return elseFn();
  }
  okOr<E>(err: E): Err<E> {
    return Err(err);
  }
  okOrElse<E>(errFn: () => E): Err<E> {
    return Err(errFn());
  }
  into<U>(intoFn: (arg: Option<never>) => U): U {
    return intoFn(this);
  }
  and<U>(rhs: Option<U>): None {
    return this;
  }
  or<U>(rhs: Option<U>): Option<U> {
    return rhs;
  }
  xor<U>(rhs: Option<U>): Some<U> | None {
    if (rhs.isSome()) return rhs;
    return this;
  }
  tap(tapFn: (arg: None) => void): None {
    tapFn(None);
    return this;
  }
  inspect(inspectFn: (value: never) => void): None {
    return this;
  }
  andEnsure<U>(ensureFn: (value: never) => Option<U>): None {
    return this;
  }
  toTag(): string {
    return Object.prototype.toString.call(this);
  }
  toJSON(): JsonRepr<never> {
    return undefined;
  }
  toString(): StringRepr<never> {
    return "";
  }
  valueOf(): ValueRepr<never> {
    return 0;
  }
  //deno-lint-ignore require-yield
  *iter(): IterableIterator<never> {
    return;
  }
  //deno-lint-ignore require-yield
  *[Symbol.iterator](): IterableIterator<never> {
    /**
     * This is actually what we want, since returning from a generator implies
     * that it's exhausted, i.e. { done: true, value: undefined }
     */
    return;
  }
  [Symbol.toPrimitive](hint?: string): "" | 0 | false {
    if (hint === "string") return "";
    if (hint === "number") return 0;
    return false;
  }
  get [Symbol.toStringTag](): string {
    return "grugway.Option.None";
  }
}

class _Some<T> implements IOption<T> {
  #value: NonNullish<T>;
  constructor(value: T) {
    assertNotNullish(value);
    this.#value = value;
  }

  isSome(): this is Some<T> {
    return true;
  }
  isNone(): this is None {
    return false;
  }
  id(): Some<T> {
    return this;
  }
  clone(options?: StructuredSerializeOptions): Some<T> {
    if (isPrimitive(this.#value)) return Some(this.#value);
    return Some(structuredClone(this.#value, options));
  }
  map<U>(mapFn: (arg: T) => NonNullish<U>): Some<NonNullish<U>> {
    return Some(mapFn(this.#value));
  }
  mapOr<U>(
    mapFn: (arg: T) => NonNullish<U>,
    orValue: NonNullish<U>,
  ): Some<NonNullish<U>> {
    return this.map(mapFn);
  }
  mapOrElse<U>(
    mapFn: (arg: T) => NonNullish<U>,
    elseFn: () => NonNullish<U>,
  ): Some<NonNullish<U>> {
    return this.map(mapFn);
  }
  filter<U extends T>(predicate: (arg: T) => arg is U): Option<U>;
  filter<U extends T>(predicate: (arg: T) => boolean): Option<U>;
  //deno-lint-ignore no-explicit-any
  filter<U extends T>(predicate: any) {
    if (predicate(this.#value)) return this as unknown as Some<U>;
    return None;
  }
  zip<U>(rhs: Option<U>): Option<[T, U]> {
    if (rhs.isNone()) return None;
    return Some([this.#value, rhs.unwrap()] as [T, U]);
  }
  andThen<U>(thenFn: (arg: T) => Option<U>): Option<U> {
    return thenFn(this.#value);
  }
  orElse<U>(elseFn: () => Option<U>): Some<T> {
    return this;
  }
  andEnsure<U>(ensureFn: (value: T) => Option<U>): Option<T> {
    const lhs = ensureFn(this.#value);
    return lhs.and(this);
  }
  unwrap(): T {
    return this.#value;
  }
  unwrapOr<U>(orValue: NonNullish<U>): T {
    return this.#value;
  }
  unwrapOrElse<U>(elseFn: () => NonNullish<U>): T {
    return this.#value;
  }
  okOr<E>(err: E): Ok<T> {
    return Ok(this.#value);
  }
  okOrElse<E>(errFn: () => E): Ok<T> {
    return Ok(this.#value);
  }
  into<U>(intoFn: (arg: Option<T>) => U): U {
    return intoFn(this);
  }
  and<U>(rhs: Option<U>): Some<U> | None {
    return rhs;
  }
  or<U>(rhs: Option<U>): Some<T> {
    return this;
  }
  xor<U>(rhs: Option<U>): Some<T> | None {
    if (rhs.isSome()) return None;
    return this;
  }
  tap(tapFn: (arg: Option<T>) => void): Option<T> {
    tapFn(this.clone());
    return this;
  }
  inspect(inspectFn: (value: T) => void): Some<T> {
    inspectFn(this.#value);
    return this;
  }
  toTag(): string {
    return Object.prototype.toString.call(this);
  }
  toJSON(): JsonRepr<T> {
    if (hasToJSON(this.#value)) return this.#value.toJSON();
    /**
     * This cast is necessary, because we need to retain the possibility of
     * T being never for the corresponding method on `None`. We know that
     * T != never for Some<T> though
     */
    return this.#value as JsonRepr<T>;
  }
  toString(): StringRepr<T> {
    /**
     * At run time this object coercion would happen implicitely anyway for primitive types
     */
    return Object(this.#value).toString();
  }
  valueOf(): ValueRepr<T> {
    /**
     * At run time this object coercion would happen implicitely anyway for primitive types
     */
    return Object(this.#value).valueOf();
  }
  *iter(): IterableIterator<T> {
    yield this.#value;
  }
  *[Symbol.iterator](): IterableIterator<
    T extends Iterable<infer U> ? U : never
  > {
    const target = Object(this.#value);
    if (Symbol.iterator in target) yield* target;
    return;
  }
  [Symbol.toPrimitive](hint?: string): string | number | boolean | symbol {
    if (isPrimitive(this.#value)) return this.#value;

    const target = Object(this.#value);

    if (Symbol.toPrimitive in target) {
      return target[Symbol.toPrimitive](hint);
    }
    return target.toString();
  }
  get [Symbol.toStringTag](): string {
    const innerTag = typeof this.#value === "object"
      ? Object.prototype.toString.call(this.#value)
      : String(this.#value);
    return `grugway.Option.Some<${innerTag}>`;
  }
}

/*
 ********************************************************************
 * module API
 ********************************************************************
 */

/**
 * `Some<T>` represents the encapsulation of a value of type `<T>`
 * An instance of `Some` can only be constructed from non-nullish values,
 * so the construction explicitely asserts that the value is not nullish
 *
 * Use {@linkcode Option} to produce a value of type `Option<T>` if T can be
 * nullish.
 *
 * Be aware that this is not only a compile time check, but also enforced
 * at runtime.
 *
 * `Some<T>` is a thin wrapper around `<T>`, in addition to the API one would
 * expect, it implements the iterator protocol and delegates to the underlying
 * implementations of `<T>` when:
 *   - used as an IterableIterator (returns `<T>` if not implemented)
 *   - explicitely or implicitely [coerced](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#primitive_coercion)
 *   - encoded as JSON via JSON.stringify()
 *
 * Please checkout {@linkcode None} for the opposite case.
 *
 * @throws {Panic}
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * const str = "thing";
 * const some = Some(str);
 * const rec = { some };
 * const arr = [ ...some ]; //`String.prototype[@@iterator]()` -> UTF-8 codepoints
 *
 * assert(some instanceof Some === true);
 * assert(some.isSome() === true);
 * assert(some.isNone() === false);
 * assert(some.unwrap() === str);
 * assert(String(some) === str);
 * assert(arr.join("") === str);
 * assert(JSON.stringify(rec) === JSON.stringify({ some: "thing" }));
 * ```
 */
export type Some<T> = _Some<T>;
export function Some<T>(value: NonNullish<T>): Some<NonNullish<T>> {
  return new _Some(value);
}
/**
 * Use this to signal some kind of success irrespective of
 * the wrapped type as alternative to `Some<void>`
 *
 * Seldom useful in a pure `Option<T>` context, mostly provided
 * for compatibility with `Result<T, E>`, where using `Ok<void>`
 * to signal a successful operation would evaluate to `None`, if
 * converted into an `Option<T>`
 *
 * @category Option#Intermediate
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 * import { Empty } from "./type_utils.ts";
 *
 * const ok = Some.empty();
 *
 * assert(ok.isSome() === true);
 * ```
 */
Some.empty = function empty(): Some<Empty> {
  return Some(EMPTY);
};
Object.defineProperty(Some, Symbol.hasInstance, {
  value: <T>(lhs: unknown): lhs is Some<T> => {
    return lhs instanceof _Some;
  },
});
Object.defineProperty(Some, Symbol.toStringTag, {
  value: "grugway.Option.Some",
});

/**
 * `None` represents the absence of a value and is the opinionated, composable
 * equivalent of `undefined`.
 *
 * It supports [coercion to the falsy representation of primitive types](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#primitive_coercion)
 * Furthermore, it implements the iterator protocol and returns `undefined`
 * when it gets JSON encoded via JSON.stringify()
 *
 * Please checkout {@linkcode Some} for the opposite case.
 *
 * @implements {IOption<never>} - {@linkcode IOption} Base interface
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * assert(None instanceof Option === true);
 * assert(None.isNone() === true);
 * assert(None.unwrap() === undefined);
 * assert(String(None) === "");
 * assert([...None].length === 0);
 * assert(JSON.stringify({ a: 1, b: None }) === '{"a":1}');
 * ```
 */
export type None = _None;
export const None = new _None() as None;
Object.defineProperty(None, Symbol.hasInstance, {
  value: (lhs: unknown): lhs is None => {
    return lhs instanceof _None;
  },
});
Object.defineProperty(None, Symbol.toStringTag, {
  value: "grugway.Option.None",
});
Object.freeze(None);

/**
 * `Option<T>` represents:
 *  - EITHER the encapsulation of a value of type `<T>` via {@linkcode Some<T>}
 *  - OR the absence of a value via {@linkcode None}
 *
 * It's the composable equivalent of the union `<T | undefined>`
 *
 * Not only is it useful for representing a value OR the absence of it,
 * but also representing a value and communicating a certain fact
 * about it.
 *
 * Furthermore, it's important to note that the encapsulated vaule must not
 * be nullish
 * It's impossible to create an instance of `Some<null | undefined>`
 *
 * Additional constructors are provided when it's desired that
 * the return type is invariant over fallible (i.e. Error) or falsy types.
 * The {@linkcode Options} module provides a couple of collection helpers.
 *
 * @property {<T>(value: T) => Option<NonNullish<T>>} from - alias for Option()
 * @property {<T>(value: T) => Option<Infallible<T>>} fromFallible - also returns None for instances of Error
 * @property {<T>(value: T) => Option<Truthy<T>>} fromCoercible - returns None for all falsy values
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * const str: string | undefined = "thing";
 * const undef: string | undefined = undefined;
 *
 * const some: Option<string> = Option(str);
 * const none: Option<string> = Option(undef);
 *
 * assert(some instanceof Option === true);
 * assert(none instanceof Option === true);
 * assert(some.isSome() === true);
 * assert(none.isNone() === true);
 * ```
 */
export type Option<T> = Some<T> | None;
export function Option<T>(value: T): Option<NonNullish<T>> {
  return isNotNullish(value) ? Some(value) : None;
}
Object.defineProperty(Option, Symbol.hasInstance, {
  value: (lhs: unknown): lhs is Option<unknown> => {
    return lhs instanceof _Some || lhs instanceof _None;
  },
});
Object.defineProperty(Option, Symbol.toStringTag, {
  value: "grugway.Option",
});

/**
 * Alias for Option()
 *
 * @category Option#Basic
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * const some = Option.from("thing" as string | undefined);
 * const none = Option.from(undefined as string | undefined);
 *
 * assert(some.isSome() === true);
 * assert(none.isNone() === true);
 * ```
 */
Option.from = function from<T>(value: T): Option<NonNullish<T>> {
  return isNotNullish(value) ? Some(value) : None;
};

/**
 * Use this if instances of `Error` should be evaluated to `None`
 *
 * Behaves like Option.from() but also returns None for instances of Error
 *
 * @category Option#Intermediate
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * const str = "thing" as string | undefined;
 * const undef = undefined as string | undefined;
 * const err = new Error() as string | Error | TypeError;
 *
 * const some: Option<string> = Option.fromFallible(str);
 * const none: Option<string> = Option.fromFallible(undef);
 * const alsoNone: Option<string> = Option.fromFallible(err);
 *
 * assert(some instanceof Option === true);
 * assert(none instanceof Option === true);
 * assert(alsoNone instanceof Option === true);
 * assert(some.isSome() === true);
 * assert(none.isNone() === true);
 * assert(alsoNone.isNone() === true);
 * ```
 */
Option.fromFallible = function fromFallible<T>(
  value: T,
): Option<Infallible<T>> {
  if (isInfallible(value)) return Option.from(value);
  return None;
};

/**
 * Use this if all falsy values should be evaluated to `None`
 *
 * Behaves like Option.from() but returns None for falsy values
 * This is also reflected in the return type in case of unions
 *
 * @category Option#Intermediate
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * type Bit = 1 | 0;
 * type Maybe = "thing" | "";
 * const str = "thing" as Maybe;
 * const bit = 0 as Bit;
 *
 * const some: Option<"thing"> = Option.fromCoercible(str);
 * const none: Option<1> = Option.fromCoercible(bit);
 *
 * assert(some instanceof Option === true);
 * assert(none instanceof Option === true);
 * assert(some.isSome() === true);
 * assert(none.isNone() === true);
 * ```
 */
Option.fromCoercible = function fromCoercible<T>(
  value: T,
): Option<Truthy<T>> {
  if (isTruthy(value)) return Option.from(value);
  return None;
};

/**
 * Use this to apply an `Option<T>` to a handler of type `Option<MapFn>`
 *
 * |  fn( arg )      |   arg: Some<T> |   arg: None   |
 * |-----------------|----------------|---------------|
 * | fn: Some<MapFn> | Some<MapFn<T>> |     None      |
 * | fn:    None     |      None      |     None      |
 *
 * This emulates the typical behavior of `Applicative` in functional
 * languages
 *
 * NOTE: `Some<T>` and `None` are not applicative functors
 * as this capability is exposed via the type and not the instances
 *
 * See [`Applicative`](https://en.wikipedia.org/wiki/Applicative_functor)
 *
 * @category Option#Advanced
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * const double = (n: number) => n * 2;
 * const maybeFn = Option.from(double);
 * const maybeArg = Option.from(21);
 *
 * const result = Option.apply(maybeFn, maybeArg);
 *
 * assert(result.isSome() === true);
 * assert(result.unwrap() === 42);
 * ```
 */
Option.apply = function apply<Args extends Readonly<unknown>, R>(
  fn: Option<(args: Args) => R>,
  arg: Option<Args>,
): Option<NonNullish<R>> {
  if (fn.isNone() || arg.isNone()) return None;
  return Option.from(fn.unwrap()(arg.unwrap()));
};

/**
 * Use this to return the provided instance of `Option<T>`
 * Mostly usefull for flattening or en lieu of a no-op
 *
 * @category Option#Basic
 */
Option.id = function id<T>(
  opt: Readonly<Option<T>> | Option<T>,
): Option<T> {
  return opt.id();
};

/**
 * Use this to compose functions and `Option` constructors
 *
 * Allows interleaving a given chain of operations on instances of type
 * `Option<T>` with (sort of) arbirtrary operations by lifting them into
 * an `Option` context
 *
 * This is useful in situations, where it's necessary to perform computations
 * on the wrapped value of type `<T>`, but the available functions are
 * invariant over the provided `map()` or `andThen()` methods' parameters
 *
 * Furthermore, it allows for composing functions with custom `Option`
 * constructors to preserve certain invariants
 *
 * @category Option#Advanced
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * function double(n: number) { return n * 2; }
 *
 * // lift wraps the return value in Option using the provided ctor
 * const lifted = Option.lift(double, Option.fromCoercible);
 *
 * assert(lifted(21).unwrap() === 42);
 * assert(lifted(0).isNone() === true); // 0 is falsy -> None
 * ```
 */
Option.lift = function lift<
  Args extends Readonly<unknown[]>,
  R1,
  R2 = NonNullish<R1>,
>(
  fn: (...args: Args) => R1,
  ctor: (arg: R1) => Option<R2> = Option.from as (arg: R1) => Option<R2>,
): (...args: Args) => Option<R2> {
  return function (...args: Readonly<Args>): Option<R2> {
    return ctor(fn(...args));
  };
};

/**
 * Same as {@linkcode Option.lift} but with a safety net.
 *
 * Use this if the function to be lifted might throw. In case of an
 * exception, `None` is returned.
 *
 * @category Option#Advanced
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 *
 * function fallible(input: number): number {
 *   if (input === 42) return input;
 *   throw TypeError("Not even!");
 * }
 *
 * const lifted = Option.liftFallible(fallible, Option.fromCoercible);
 *
 * const maybe = Option.from(42).andThen(lifted);
 *
 * assert(maybe.isSome() === true);
 * assert(maybe.unwrap() === 42);
 * ```
 */
Option.liftFallible = function liftFallible<
  Args extends Readonly<unknown[]>,
  R1,
  R2 = NonNullish<R1>,
>(
  fn: (...args: Args) => R1,
  ctor: (arg: R1) => Option<R2> = Option.from as (arg: R1) => Option<R2>,
): (...args: Args) => Option<R2> {
  return function (...args: Readonly<Args>): Option<R2> {
    try {
      return ctor(fn(...args));
    } catch (_) {
      return None;
    }
  };
};

/**
 * Use this to infer the encapsulated `<T>` type from a `Some<T>`
 *
 * @category Option#Basic
 */
export type InferredSomeType<O extends Readonly<Option<unknown>>> = O extends
  Readonly<Some<infer T>> ? T : never;

/**
 * Use this to infer an `Option<T>` type
 *
 * @categroy Option#Basic
 */
//deno-lint-ignore no-explicit-any
export type InferredOptionType<O extends Readonly<Option<any>>> = O extends
  Readonly<None> ? None
  : O extends Readonly<Some<infer T1>> ? Some<T1>
  : [O] extends [Readonly<Option<infer T2>>] ? [Option<T2>]
  : never;
