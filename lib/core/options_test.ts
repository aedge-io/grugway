import { assertStrictEquals } from "@std/assert";
import { assertType, type IsExact } from "@std/testing/types";
import { None, Option, Some } from "./option.ts";
import {
  all,
  any,
  areNone,
  areSome,
  type InferredSomeTuple,
} from "./options.ts";

Deno.test("grugway::Options", async (t) => {
  await t.step(
    ".areSome() -> returns true and narrows type if all elements are Some",
    () => {
      const opts: Option<string>[] = [Some("a"), Some("b"), Some("c")];

      const result = areSome(opts);

      assertStrictEquals(result, true);

      if (result) {
        assertType<IsExact<typeof opts, Some<string>[]>>(true);
      }
    },
  );
  await t.step(
    ".areSome() -> returns false if any element is None",
    () => {
      const opts: Option<string>[] = [Some("a"), None, Some("c")];

      const result = areSome(opts);

      assertStrictEquals(result, false);
    },
  );
  await t.step(
    ".areNone() -> returns true and narrows type if all elements are None",
    () => {
      const opts: Option<string>[] = [None, None, None];

      const result = areNone(opts);

      assertStrictEquals(result, true);

      if (result) {
        assertType<IsExact<typeof opts, None[]>>(true);
      }
    },
  );
  await t.step(
    ".areNone() -> returns false if any element is Some",
    () => {
      const opts: Option<string>[] = [None, Some("b"), None];

      const result = areNone(opts);

      assertStrictEquals(result, false);
    },
  );
  await t.step(".all() -> returns None for empty arrays", () => {
    const empty: Option<string>[] = [];

    const emptyIsNone: Option<string[]> = all(empty);
    if (emptyIsNone.isSome()) {
      throw TypeError("Unreachable in this test");
    }
    const undef: undefined = emptyIsNone.unwrap();

    assertStrictEquals(emptyIsNone.isNone(), true);
    assertStrictEquals(undef, undefined);
  });
  await t.step(
    ".all() -> returns Some<T[]> only if all elements are Some",
    () => {
      type StrictTuple = Readonly<[string, number, boolean]>;
      const correctTuple = [
        Option("some" as string),
        Option(1 as number),
        Option(true as boolean),
      ] as const;
      const wrongTuple = [
        Option("some" as string),
        Option(1 as number),
        Option.fromCoercible(false as boolean),
      ] as const;
      const encode = JSON.stringify;

      const someTuple: Option<StrictTuple> = all(correctTuple);
      const noneTuple: Option<StrictTuple> = all(wrongTuple);
      if (someTuple.isNone() || noneTuple.isSome()) {
        throw TypeError("Unreachable in this test");
      }
      const unwrapped: StrictTuple = someTuple.unwrap();
      const undef: undefined = noneTuple.unwrap();

      assertStrictEquals(someTuple.isSome(), true);
      assertStrictEquals(noneTuple.isNone(), true);
      /**
       * See the `toJSON` tests under the `JS well-known Symbols and Methods`
       * section to understand why this works
       * {@linkcode Some#toJSON}
       */
      assertStrictEquals(encode(unwrapped), encode(correctTuple));
      assertStrictEquals(undef, undefined);
    },
  );
  await t.step(
    ".all() -> Heterogenous tuple types are correctly inferred",
    () => {
      type TestTuple = Readonly<[string, number, { a: number[] }]>;
      const optionTuple = [
        Option("abc" as string),
        Option(100 as number),
        Option({ a: [] } as { a: number[] }),
      ] as const;
      const someTuple = [
        Some("abc" as string),
        Some(100 as number),
        Some({ a: [] } as { a: number[] }),
      ] as const;

      const collectedOpts = all(optionTuple);
      const collectedSomes = all(someTuple);

      if (collectedOpts.isSome() && collectedSomes.isSome()) {
        const unwrappedOpts = collectedOpts.unwrap();
        const unwrappedSomes = collectedSomes.unwrap();

        assertType<IsExact<typeof unwrappedOpts, TestTuple>>(true);
        assertType<IsExact<typeof unwrappedSomes, TestTuple>>(true);
      } else {
        throw TypeError("Unreachable");
      }
    },
  );
  await t.step(
    ".all() -> Array types are correctly inferred and retain constraints",
    () => {
      type TestArray = ReadonlyArray<string>;
      type TestArrayMut = Array<string>;
      const optArray: ReadonlyArray<Option<string>> = Array.of(..."option").map(
        (
          char,
        ) => Option(char),
      );
      const optArrayMut: Array<Option<string>> = Array.of(..."option").map((
        char,
      ) => Option(char));

      const collected = all(optArray);
      const collectedMut = all(optArrayMut);

      if (collected.isSome() && collectedMut.isSome()) {
        const unwrapped = collected.unwrap();
        const unwrappedMut = collectedMut.unwrap();

        assertType<IsExact<typeof unwrapped, TestArray>>(true);
        assertType<IsExact<typeof unwrappedMut, TestArrayMut>>(true);
      } else {
        throw TypeError("Unreachable");
      }
    },
  );
  await t.step(
    ".any() -> returns None for empty arrays or if all elements are None",
    () => {
      const emptyArr: Option<string>[] = [];
      const noneArr = [None, None, None];

      const empty = any(emptyArr);
      const none = any(noneArr);

      assertStrictEquals(empty.isNone(), true);
      assertStrictEquals(none.isNone(), true);
    },
  );
  await t.step(
    ".any() -> returns the first Some found in Option<T>[]",
    () => {
      type Prime = number;
      const toPrime = function (n: number): Option<Prime> {
        if (!Number.isSafeInteger(n) || n < 2) return None;
        if (n % 2 === 0) return (n !== 2) ? None : Some(n);
        if (n % 3 === 0) return (n !== 3) ? None : Some(n);

        const m = Math.sqrt(n);
        for (let i = 5; i <= m; i += 6) {
          if (n % i === 0) return None;
          if (n % (i + 2) === 0) return None;
        }
        return Some(n);
      };
      const makeRange = function* (start: number, end: number) {
        let cursor = start;
        while (cursor < end) {
          yield cursor;
          cursor += 1;
        }
        return cursor;
      };

      const maybePrimes: Option<Prime>[] = [...makeRange(9, 19)].map(toPrime);
      const firstPrime = any(maybePrimes);

      assertStrictEquals(firstPrime.isSome(), true);
      assertStrictEquals(firstPrime.unwrap(), 11);
    },
  );
});

Deno.test("grugway::Options::InferredTypes", async (t) => {
  await t.step(
    "InferredSomeTuple<O> -> Infers T[] from Option<T>[]",
    () => {
      type StrictTuple = Readonly<[string, number, boolean]>;
      const correctTuple = [
        Option("some" as string),
        Some(1 as number),
        Option(true as boolean),
      ] as const;

      assertType<
        IsExact<InferredSomeTuple<typeof correctTuple>, StrictTuple>
      >(true);
    },
  );
});
