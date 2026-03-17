import type { Option } from "./option.ts";
import { None, Some } from "./option.ts";

/**
 * Type predicate - use this to check if all values in an array are `Some<T>`
 *
 * @category Option#Basic
 */
export function areSome<T>(
  opts: ReadonlyArray<Option<T>>,
): opts is Some<T>[] {
  return opts.every((opt) => opt.isSome());
}

/**
 * Type predicate - use this to check if all values in an array are `None`
 *
 * @category Option#Basic
 */
export function areNone<T>(
  opts: ReadonlyArray<Option<T>>,
): opts is None[] {
  return opts.every((opt) => opt.isNone());
}

/**
 * Use this to transpose `Option<T>[]` to `Some<T[]>` if all elements are
 * `Some<T>`
 *
 * If one element is `None`, or if the input array/tuple is empty, `None`
 * is immediately returned
 *
 * This function retains type constraints like `readonly` on the input array
 * or tuple and is able to infer variadic tuples. Of course it also work with
 * any `Iterable<Option<T>>`
 *
 * @category Option#Intermediate
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 * import * as Options from "./options.ts";
 *
 * type StrictTuple = Readonly<[string, number, boolean]>;
 * const tuple = [
 *   Option("some" as string),
 *   Option(1 as number),
 *   Option(true as boolean),
 * ] as const;
 * const empty: Option<string>[] = [];
 * const encode = JSON.stringify;
 *
 * const someTuple: Option<StrictTuple> = Options.all(tuple);
 * const emptyIsNone : Option<string[]> = Options.all(empty);
 *
 * if (someTuple.isNone() || emptyIsNone.isSome()) {
 *   throw TypeError("Unreachable in this example");
 * }
 *
 * const unwrapped: StrictTuple = someTuple.unwrap();
 * const undef: undefined = emptyIsNone.unwrap();
 *
 * assert(someTuple.isSome() === true);
 * assert(emptyIsNone.isNone() === true);
 * assert(encode(unwrapped) === encode(tuple));
 * assert(undef === undefined);
 * ```
 */
export function all<O extends ReadonlyArray<Option<unknown>>>(
  opts: O,
): Option<InferredSomeTuple<O>>;
export function all<T>(
  opts: Iterable<Option<T>>,
): Option<T[]>;
//deno-lint-ignore no-explicit-any
export function all(opts: any): any {
  const areSome = [];

  for (const opt of opts) {
    if (opt.isNone()) {
      return None;
    } else {
      areSome.push(opt.unwrap());
    }
  }

  return areSome.length !== 0 ? Some(areSome) : None;
}

/**
 * Use this to extract the first element of type `Some<T>` from an
 * `Option<T>[]` or `Iterable<Option<T>>`
 *
 * If no item is `Some<T>` or the input array is empty, `None` is returned
 *
 * @category Option#Intermediate
 *
 * @example
 * ```typescript
 * import { assert } from "@std/assert";
 * import { Option, None, Some } from "./option.ts";
 * import * as Options from "./options.ts";
 *
 * type Prime = number;
 * const toPrime = function (n: number): Option<Prime> {
 *   if (!Number.isSafeInteger(n) || n < 2) return None;
 *   if (n % 2 === 0) return (n !== 2) ? None : Some(n);
 *   if (n % 3 === 0) return (n !== 3) ? None : Some(n);

 *   const m = Math.sqrt(n);
 *   for (let i = 5; i <= m; i += 6) {
 *     if (n % i === 0) return None;
 *     if (n % (i + 2) === 0) return None;
 *   }
 *   return Some(n);
 * };
 * const makeRange = function* (start: number, end: number) {
 *   let cursor = start;
 *   while (cursor < end) {
 *     yield cursor;
 *     cursor += 1;
 *   }
 *   return cursor;
 * };

 * const maybePrimes: Option<Prime>[] = [...makeRange(9, 19)].map(toPrime);
 * const firstPrime = Options.any(maybePrimes);
 *
 * assert(firstPrime.isSome() === true);
 * assert(firstPrime.unwrap() === 11);
 * ```
 */
export function any<O extends ReadonlyArray<Option<unknown>>>(
  opts: O,
): Option<InferredSomeUnion<O>>;
export function any<T>(
  opts: Iterable<Option<T>>,
): Option<T>;
//deno-lint-ignore no-explicit-any
export function any(opts: any): any {
  for (const opt of opts) {
    if (opt.isSome()) return opt;
  }
  return None;
}

/**
 * Use this to infer the encapsulated `Some<T>` types from a tuple of `Option<T>`
 *
 * @category Option#Intermediate
 */
export type InferredSomeTuple<
  Opts extends Readonly<ArrayLike<Option<unknown>>>,
> = {
  [i in keyof Opts]: Opts[i] extends Option<infer T> ? T : never;
};

/**
 * Use this to infer a union of all `Some<T>` types from a tuple of `Option<T>`
 *
 * @category Option#Intermediate
 */
export type InferredSomeUnion<
  Opts extends Readonly<ArrayLike<Option<unknown>>>,
> = InferredSomeTuple<Opts>[number];
