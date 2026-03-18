import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertNotStrictEquals,
  assertObjectMatch,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import {
  assertType,
  type Has,
  type IsExact,
  type IsNullable,
} from "@std/testing/types";
import {
  type InferredOptionType,
  type InferredSomeType,
  None,
  Option,
  Some,
} from "./option.ts";
import type { NonNullish } from "./type_utils.ts";
import { Panic } from "./errors.ts";

/**
 * Setup test value collections
 */

const str = "abc";
const num = -123;
const bnum = 6n;
const inf = Infinity;
const b = true;
const arr = [1, 2, 3];
const rec = { a: "a", b: 42 };
const sym = Symbol("from::test");
const date = new Date();

const emptyStr = "";
const zero = 0;
const bnZero = 0n;

class Wellknown {
  constructor(public a = 1, public b = 2, private c = 3) {}
  get [Symbol.toStringTag]() {
    return "Well-known symbols and methods";
  }
  [Symbol.toPrimitive](hint: string) {
    if (hint === "string") return this.toString();
    return this.valueOf();
  }
  *[Symbol.iterator]() {
    yield this.a;
    yield this.b;
  }
  toJSON() {
    return { ...this, c: "***" };
  }
  toString() {
    return String(this.a + this.b + this.c);
  }
  valueOf() {
    return this.a + this.b + this.c;
  }
}
const wellknown = new Wellknown();

const err = new Error("test::error");

const falsyNotNullish = [false, NaN, emptyStr, zero, bnZero];
const nullish = [null, undefined];

const allTruthy = [str, num, bnum, inf, b, arr, rec, sym, date, wellknown];
// @ts-ignore-lines These heterogenous arrays break type inference
const allInfallible = allTruthy.concat(falsyNotNullish);
// @ts-ignore-lines These heterogenous arrays break type inference
const allNonNullish = allInfallible.concat([err]);
// @ts-ignore-lines These heterogenous arrays break type inference
const allFalsy = falsyNotNullish.concat(nullish);
// @ts-ignore-lines These heterogenous arrays break type inference
const allFallible = nullish.concat([err]);
// @ts-ignore-lines These heterogenous arrays break type inference
const allValues = allNonNullish.concat(nullish);

/**
 * Type-level helpers used in type assertions
 */
type IsOption<O> = O extends Option<unknown> ? true : false;
type OptionType<O> = O extends Readonly<Option<infer T>> ? T : never;
type SomeType<S> = S extends Readonly<Some<infer T>> ? T : never;

Deno.test("grugway::Option", async (t) => {
  await t.step("() -> returns Some for NonNullish values", () => {
    allNonNullish.forEach((val) => {
      const some = Option(val);
      assertEquals(some.isSome(), true, `${String(val)} should be Some`);
      assertEquals(some.isNone(), false, `${String(val)} should be Some`);
      assertStrictEquals(some.unwrap(), val);
    });
  });
  await t.step("() -> returns None for Nullish values", () => {
    nullish.forEach((val) => {
      const none = Option(val);

      assertEquals(none.isSome(), false, `${String(val)} should be None`);
      assertEquals(none.isNone(), true, `${String(val)} should be None`);
      assertStrictEquals(none.unwrap(), undefined);
    });
  });
  await t.step(
    ".from() -> returns Some for NonNullish values with Nullish types stripped",
    () => {
      allNonNullish.forEach((val) => {
        const some = Option.from(val);

        assertEquals(some.isSome(), true, `${String(val)} should be Some`);
        assertEquals(some.isNone(), false, `${String(val)} should be Some`);
        assertStrictEquals(some.unwrap(), val);
      });

      const input: string | undefined | null = "abc";
      const option = Option.from(input);

      assertType<IsNullable<SomeType<typeof option>>>(false);
      assertStrictEquals(option.isSome(), true);
    },
  );
  await t.step(".from() -> returns None for Nullish values", () => {
    nullish.forEach((val) => {
      const none = Option.from(val);

      assertEquals(none.isSome(), false, `${String(val)} should be None`);
      assertEquals(none.isNone(), true, `${String(val)} should be None`);
      assertStrictEquals(none.unwrap(), undefined);
    });
  });
  await t.step(
    ".fromFallible() -> returns Some for Truthy and FalsyNotNullish values with Nullish and Error types stripped",
    () => {
      allInfallible.forEach((val) => {
        const some = Option.fromFallible(val);

        assertEquals(some.isSome(), true, `${String(val)} should be Some`);
        assertEquals(some.isNone(), false, `${String(val)} should be Some`);
        assertStrictEquals(some.unwrap(), val);
      });

      const input: string | null | undefined | Error = "abc";
      const option = Option.fromFallible(input);

      assertType<IsExact<typeof option, Option<string>>>(true);
      assertStrictEquals(option.isSome(), true);
    },
  );
  await t.step(
    ".fromFallible() -> returns None for Nullish and Error values",
    () => {
      allFallible.forEach((val) => {
        const none = Option.fromFallible(val);

        assertEquals(none.isSome(), false, `${String(val)} should be None`);
        assertEquals(none.isNone(), true, `${String(val)} should be None`);
        assertStrictEquals(none.unwrap(), undefined);
      });
    },
  );
  await t.step(
    ".fromCoercible() -> returns Some for Truthy values with Falsy types stripped",
    () => {
      allTruthy.forEach((val) => {
        const some = Option.fromCoercible(val);

        assertEquals(some.isSome(), true, `${String(val)} should be Some`);
        assertEquals(some.isNone(), false, `${String(val)} should be Some`);
        assertStrictEquals(some.unwrap(), val);
      });

      const input: number | "" | false | 0 = NaN;
      const option = Option.fromCoercible(input);

      assertType<IsExact<typeof option, Option<number>>>(true);
      assertStrictEquals(option.isSome(), false);
    },
  );
  await t.step(
    ".fromCoercible() -> returns None for Falsy values",
    () => {
      allFalsy.forEach((val) => {
        const none = Option.fromCoercible(val);

        assertEquals(none.isSome(), false, `${String(val)} should be None`);
        assertEquals(none.isNone(), true, `${String(val)} should be None`);
        assertStrictEquals(none.unwrap(), undefined);
      });
    },
  );
  await t.step(
    ".fromCoercible() -> Falsy types stripped from inner union return type",
    () => {
      type LiteralUnion = "a" | "b" | "c" | "" | 0;
      const input: LiteralUnion = "a";
      const option = Option.fromCoercible(input as LiteralUnion);

      assertType<IsExact<typeof option, Option<"a" | "b" | "c">>>(true);
      assertStrictEquals(option.isSome(), true);
    },
  );
  await t.step(
    ".identity() -> identity type is correctly inferred",
    () => {
      const opt = Option("some");
      const nested = Option(opt);
      const strict = Option("some") as Readonly<Option<string>>;

      const identity = Option.id(opt);
      const nestedIdentity = Option.id(nested);
      const strictIdentity = Option.id(strict);

      assertType<IsExact<typeof identity, Option<string>>>(true);
      assertType<IsExact<typeof nestedIdentity, Option<Option<string>>>>(true);
      assertType<IsExact<typeof strictIdentity, Option<string>>>(true);
    },
  );
  await t.step(
    ".apply() -> returns the correct result for variadic functions",
    () => {
      type UserRecord = {
        name: string;
        email: string;
        role: string;
        org: string;
        lastSeen: Date;
        scopes: string[];
      };
      const record: UserRecord = {
        name: "Allen",
        email: "allen@example.com",
        role: "Staff",
        org: "Sales",
        lastSeen: new Date(2023, 2, 23),
        scopes: ["read:sales", "write:sales", "read:customer"],
      };

      const extractScopes = (rec: UserRecord): string[] => rec.scopes;
      const maybeAction = Option.from(extractScopes);
      const maybeRec = Option.from(record);

      const maybeScopes = Option.apply(maybeAction, maybeRec);

      assertStrictEquals(maybeScopes.isSome(), true);
    },
  );
  await t.step(
    ".apply() -> returns None if fn or arg is None",
    () => {
      const add = (n: number) => n + 1;
      const maybeFn = Option.from(add);
      const noneArg = Option.from(undefined as number | undefined);
      const noneFn = Option.from(
        undefined as ((n: number) => number) | undefined,
      );
      const someArg = Option.from(42);

      const noneBecauseArg = Option.apply(maybeFn, noneArg);
      const noneBecauseFn = Option.apply(noneFn, someArg);
      const noneBecauseBoth = Option.apply(noneFn, noneArg);

      assertStrictEquals(noneBecauseArg.isNone(), true);
      assertStrictEquals(noneBecauseFn.isNone(), true);
      assertStrictEquals(noneBecauseBoth.isNone(), true);
    },
  );
  await t.step(
    ".lift() -> composes functions and constructors correctly",
    () => {
      function chainDivide(n: number, ...divisors: number[]) {
        return divisors.reduce((acc, divisor) => acc /= divisor, n);
      }

      function getDivident(): Option<number> {
        return Option.from(42);
      }
      function getDivisors(): Option<number[]> {
        return Option.from([7, 3, 2]);
      }

      function wrappedDiv(n: number, ...divisors: number[]) {
        const res = chainDivide(n, ...divisors);

        if (
          res === 0 || Number.isNaN(res) || !Number.isFinite(res)
        ) return None;
        return Some(res);
      }

      const liftedDiv = Option.lift(chainDivide, Option.fromCoercible);

      const divident = getDivident();
      const divisors = getDivisors();
      const args = divident.zip(divisors);

      const someWrapped = args.andThen((args) =>
        wrappedDiv(args[0], ...args[1])
      );
      const someLifted = args.andThen((args) => liftedDiv(args[0], ...args[1]));

      assertStrictEquals(someWrapped.isSome(), true);
      assertStrictEquals(someLifted.isSome(), true);
      assertStrictEquals(someWrapped.unwrap(), 1);
      assertStrictEquals(someLifted.unwrap(), 1);
    },
  );
  await t.step(
    ".lift() -> Fn type is correctly inferred",
    () => {
      const isNonZeroInt = (n: number): boolean | undefined => {
        if (Number.isSafeInteger(n) && n > 0) return true;
        return false;
      };

      const isNotFortyTwo = function (
        n: number,
      ): boolean | undefined | Error | TypeError {
        if (n === 42) return Error("Cannot be 42");
        return isNonZeroInt(n);
      };

      const lifted = Option.lift(isNonZeroInt);
      const liftedWithCoercible = Option.lift(
        isNonZeroInt,
        Option.fromCoercible,
      );
      const liftedWithFallible = Option.lift(
        isNotFortyTwo,
        Option.fromFallible,
      );

      assertType<IsExact<typeof lifted, (n: number) => Option<boolean>>>(true);
      assertType<
        IsExact<typeof liftedWithCoercible, (n: number) => Option<true>>
      >(true);
      assertType<
        IsExact<typeof liftedWithFallible, (n: number) => Option<boolean>>
      >(true);
    },
  );
  await t.step(
    ".lift() -> allows for composition of custom Option constructors",
    () => {
      type Left<L> = { tag: "Left"; value: L };
      type Right<R> = { tag: "Right"; value: R };
      type Either<L, R> = Left<L> | Right<R>;
      type Numeric<T> = T extends number | bigint ? T : never;
      type NonNumeric<T> = NonNullish<Exclude<T, Numeric<T>>>;
      function isNonNumeric<T>(arg: T): arg is NonNumeric<T> {
        if (arg == null || typeof arg === "number" || typeof arg === "bigint") {
          return false;
        }
        return true;
      }

      function fromEither<L, R>(
        e?: Either<L, R>,
      ): Option<NonNumeric<R>> {
        if (e?.tag === "Right" && isNonNumeric(e?.value)) return Some(e.value);
        return None;
      }

      function tupleToEither(
        arg: Readonly<[string, number | boolean]>,
      ): Either<typeof arg[0], typeof arg[1]> {
        return { tag: "Right", value: arg[1] };
      }

      function getTuple(): [string, number | boolean] {
        return ["something", true];
      }

      const lifted = Option.lift(tupleToEither, fromEither);

      assertType<
        IsExact<Parameters<typeof lifted>, Parameters<typeof tupleToEither>>
      >(true);
      assertType<
        IsExact<
          ReturnType<typeof lifted>,
          ReturnType<typeof fromEither<string, number | boolean>>
        >
      >(true);

      const res = Option.from(getTuple()).andThen(lifted);

      assertStrictEquals(res.isSome(), true);
      assertStrictEquals(res.unwrap(), true);
    },
  );
  await t.step(
    ".liftFallible() -> returns None if lifted function panics",
    () => {
      function panics(n: number): number {
        if (n % 2 === 0) return n;
        throw new Error("Panic");
      }

      const lifted = Option.liftFallible(panics, Option.fromCoercible);

      const res = Option.from(41).andThen(lifted);

      assertType<IsExact<Parameters<typeof lifted>, Parameters<typeof panics>>>(
        true,
      );
      assertType<IsExact<ReturnType<typeof lifted>, Option<number>>>(true);
      assertStrictEquals(res.isNone(), true);
    },
  );
  await t.step(
    "[Symbol.hasInstance]() -> instanceof returns true for instances of Some & None",
    () => {
      allValues.forEach((val) => {
        const opt = Option.from(val);

        const isInstance = opt instanceof Option;
        const isNotInstance = !(val instanceof Option);

        assertStrictEquals(isInstance, true);
        assertStrictEquals(isNotInstance, true);
      });
    },
  );
});

Deno.test("grugway::Option::InferredTypes", async (t) => {
  await t.step("InferredSomeType<O> -> Infers T from Option<T>", () => {
    const opt = Option(123);
    type StrictOption = Readonly<Option<number[]>>;
    type NormalOption = Option<Record<string, string>>;

    assertType<IsExact<InferredSomeType<StrictOption>, number[]>>(true);
    assertType<IsExact<InferredSomeType<NormalOption>, Record<string, string>>>(
      true,
    );
    assertType<IsExact<InferredSomeType<typeof opt>, number>>(true);
  });

  await t.step(
    "InferredOptionType<O> -> Infers Option<T> from union",
    () => {
      const thenFn = (b: boolean) => {
        if (b) return Option("abc");
        return Option(["a", "b", "c"]);
      };

      assertType<
        Has<
          InferredOptionType<ReturnType<typeof thenFn>>,
          Option<string | string[]>
        >
      >(true);
    },
  );
});

Deno.test("grugway::Option::Some", async (t) => {
  await t.step("Some<T> -> Ctor", async (t) => {
    await t.step(
      "() -> throws if instantiated with nullish value",
      () => {
        //deno-lint-ignore ban-types
        const secretelyNullish = null as unknown as {};

        assertThrows(() => Some(secretelyNullish), Panic);
      },
    );

    await t.step("() -> doesn't accept Nullish types", () => {
      type NullishUnion = string | undefined | null;

      /**
       * These examples don't compile:
       *
       * const nullish = undefined;
       * const maybeNullish = (): NullishUnion => undefined;
       *
       * const notSome = Some(nullish);
       *                      ^^^^^^^
       * const tryMaybe = Some(maybeNullish());
       *                       ^^^^^^^^^^^^^^
       */

      const input = "abc";
      const some = Some(input);

      assertType<
        IsNullable<Parameters<typeof Some>>
      >(false);
      assertType<
        Has<Parameters<typeof Some>, NullishUnion>
      >(false);

      assertStrictEquals(some.isSome(), true);
    });
  });
  await t.step("Some<T> -> Type Predicates", async (t) => {
    await t.step(".isSome() -> returns true and narrows to Some", () => {
      const some = Some("thing");
      const opt = Option.from("abc" as string | undefined);

      const isSome = some.isSome();

      assertStrictEquals(isSome, true);

      if (opt.isSome()) {
        const str = opt.unwrap();

        assertType<IsExact<typeof str, string>>(true);
      }

      const union = opt.unwrap();

      assertType<IsExact<typeof union, string | undefined>>(true);

      assertStrictEquals(opt.isSome(), true);
    });

    await t.step(".isNone() -> returns false", () => {
      const some = Some("thing");

      const isNone = some.isNone();

      assertStrictEquals(isNone, false);
    });
  });

  await t.step("Some<T> -> Logical Combinators (&&, ||, ^)", async (t) => {
    await t.step(".and() -> returns RHS with type inferred from RHS", () => {
      const lhs = Some("thing");
      const rhs = Some("thingelse");

      const res = lhs.and(rhs);

      assertStrictEquals(res, rhs);
      assertStrictEquals(res.unwrap(), rhs.unwrap());

      const lhsTyped = Some("abc");
      const rhsTyped = Some(123);
      const resTyped = lhsTyped.and(rhsTyped);

      assertType<
        IsExact<SomeType<typeof rhsTyped>, SomeType<typeof resTyped>>
      >;

      assertStrictEquals(rhsTyped.unwrap(), resTyped.unwrap());
    });

    await t.step(".or() -> returns LHS with type inferred from LHS", () => {
      const lhs = Some("thing");
      const rhs = Some("thingelse");

      const res = lhs.or(rhs);

      assertStrictEquals(res, lhs);
      assertStrictEquals(res.unwrap(), lhs.unwrap());

      const lhsTyped = Some("abc");
      const rhsTyped = Some(123);
      const resTyped = lhsTyped.or(rhsTyped);

      assertType<
        IsExact<SomeType<typeof resTyped>, SomeType<typeof lhsTyped>>
      >(true);

      assertStrictEquals(lhsTyped.unwrap(), resTyped.unwrap());
    });

    await t.step(
      ".xor() -> returns LHS if RHS is None with type inferred from LHS or union",
      () => {
        const lhs = Some("thing");
        const rhs = None;

        const res = lhs.xor(rhs);

        assertStrictEquals(res, lhs);
        assertStrictEquals(res.unwrap(), lhs.unwrap());

        const lhsTyped = Some("abc");
        const lhs2 = Option.from("abc");
        const rhsTyped = Option.from(123);
        const resTyped = lhsTyped.xor(rhsTyped);
        const res2 = lhs2.xor(rhsTyped);

        assertType<
          IsExact<SomeType<typeof resTyped>, SomeType<typeof lhsTyped>>
        >(true);
        assertType<
          IsExact<SomeType<typeof res2>, string | number>
        >(true);
        assertType<
          IsExact<typeof res2, typeof lhs2 | typeof rhsTyped>
        >(true);

        assertStrictEquals(resTyped.isNone(), true);
      },
    );

    await t.step(".xor() -> returns None if LHS and RHS are Some", () => {
      const lhs = Some("thing");
      const rhs = Some("thingelse");

      const res = lhs.xor(rhs);

      assertStrictEquals(res, None);
    });

    await t.step(
      ".and().or().xor() -> chaining returns the equivalent result as logical operations on coercible values",
      () => {
        const lhs = Some("thing");
        const rhs1 = Some("thingelse");
        const rhs2 = Some("otherthing");
        const rhs3 = None as Option<string>;

        const res = lhs.and(rhs1).or(rhs2).xor(rhs3);
        // here xor is actually a bitwise operator, but since
        // 0 and 1 are coercible to false and true respectively,
        // we can use this to emulate the non-exisitng logical
        // xor operator.
        const equivalent = ((1 && 1) || 1) ^ 0;

        assertStrictEquals(equivalent, 1);
        assertStrictEquals(res.isSome(), Boolean(equivalent));
        assertStrictEquals(res, rhs1);
        assertStrictEquals(res.unwrap(), "thingelse");
      },
    );

    await t.step(
      ".and().or().xor() -> return type from chaining is inferred as union",
      () => {
        const lhs = Some({ a: 1, b: 2 });
        const rhs = Some([1, 2, 3]);
        const rhs2 = Some("abc");
        const rhs3 = Option.from(null);
        const rhs4 = Some(true);
        const rhs5 = Some(123);
        const res = lhs.and(rhs).or(rhs2).xor(rhs3).and(rhs4).xor(rhs5);

        assertType<
          IsExact<SomeType<typeof res>, boolean | number>
        >(true);
        assertType<
          IsExact<typeof res, Option<boolean> | Option<number>>
        >(true);

        assertStrictEquals(res.isNone(), true);
      },
    );
  });

  await t.step("Some<T> -> Map Methods", async (t) => {
    await t.step(
      ".map() -> returns new instance of Some with applied mapFn, invariant over Nullish",
      () => {
        const double = (x: number) => x * 2;
        const toBeWrapped = 5;
        const some = Some(toBeWrapped);

        const isDoubled = some.map(double);

        assertNotStrictEquals(isDoubled, some);
        assertStrictEquals(isDoubled.unwrap(), double(toBeWrapped));

        const mapFn = (n: number): string => n < 100 ? "lt" : "gte";
        const someStr = some.map(mapFn);

        type MapMethodReturnType = ReturnType<typeof some["map"]>;

        assertType<
          IsNullable<OptionType<MapMethodReturnType>>
        >(false);

        /**
         * Example: This doesn't compile
         * const mapFn = (n: number): string | undefined => n < 100 : "less" : undefined;
         * const fails = Some(99).map(mapFn);
         *                            ^^^^^
         */

        assertStrictEquals(someStr.unwrap(), "lt");
      },
    );

    await t.step(
      ".mapOr() -> returns new instance of Some with applied mapFn, invariant over Nullish",
      () => {
        const double = (x: number) => x * 2;
        const toBeWrapped = 5;
        const defaultValue = 11;
        const some = Some(toBeWrapped);

        const isDoubled = some.mapOr(double, defaultValue);

        assertNotStrictEquals(isDoubled, some);
        assertNotStrictEquals(isDoubled.unwrap(), defaultValue);
        assertStrictEquals(isDoubled.unwrap(), double(toBeWrapped));

        const mapFn = (n: number): string => n < 100 ? "lt" : "gte";
        const someStr = some.mapOr(mapFn, "never");

        type MapOrMethodReturnType = ReturnType<typeof some["mapOr"]>;

        assertType<
          IsNullable<OptionType<MapOrMethodReturnType>>
        >(false);

        /**
         * Example: This doesn't compile
         * const mapFn = (n: number): string | undefined => n < 100 : "less" : undefined;
         * const fails = Some(99).mapOr(mapFn, undefined);
         *                              ^^^^^  ^^^^^^^^^
         */

        assertStrictEquals(someStr.unwrap(), "lt");
      },
    );

    await t.step(
      ".mapOrElse() -> returns new instance of Some with applied mapFn, invariant over Nullish",
      () => {
        const double = (x: number) => x * 2;
        const toBeWrapped = 5;
        const defaultFn = () => 11;
        const some = Some(toBeWrapped);

        const isDoubled = some.mapOrElse(double, defaultFn);

        assertNotStrictEquals(isDoubled, some);
        assertNotStrictEquals(isDoubled.unwrap(), defaultFn());
        assertStrictEquals(isDoubled.unwrap(), double(toBeWrapped));

        const mapFn = (n: number): string => n < 100 ? "lt" : "gte";
        const orFn = () => "never";
        const someStr = some.mapOrElse(mapFn, orFn);

        type MapOrElseMethodReturnType = ReturnType<typeof some["mapOrElse"]>;

        assertType<
          IsNullable<OptionType<MapOrElseMethodReturnType>>
        >(false);

        /**
         * Example: This doesn't compile
         * const mapFn = (n: number): string | undefined => n < 100 : "less" : undefined;
         * const orFn = () => undefined;
         * const fails = Some(99).mapOrElse(mapFn, orFn);
         *                                  ^^^^^  ^^^^^
         */

        assertStrictEquals(someStr.unwrap(), "lt");
      },
    );

    await t.step(
      ".filter() -> refines wrapped value and narrows type with typeguard",
      () => {
        const numOrStr = 5 as string | number;
        const isNum = (value: unknown): value is number =>
          typeof value === "number";

        const some = Option(numOrStr);
        const same = some.filter(isNum);

        assertType<IsExact<typeof same, Option<number>>>(true);

        assertStrictEquals(same, some);
        assertStrictEquals(same.isSome(), true);
      },
    );

    await t.step(
      ".filter() -> returns None if predicate fails, type unchanged",
      () => {
        const num = 5;
        const isEven = (value: number): boolean => value % 2 === 0;

        const some = Option(num);
        const none = some.filter(isEven);

        assertType<IsExact<SomeType<typeof none>, number>>(true);
        assertNotStrictEquals(none, some);
        assertStrictEquals(none.isSome(), false);
      },
    );

    await t.step(
      ".andThen() -> returns new instance of Option, return type is always Option (invariant over Nullish)",
      () => {
        const double = (x: number) => Option(x * 2);
        const toBeWrapped = 5;
        const some = Some(toBeWrapped);

        const maybeDoubled = some.andThen(double);

        assertNotStrictEquals(maybeDoubled, some);
        assertStrictEquals(maybeDoubled.unwrap(), double(toBeWrapped).unwrap());

        const mapFn = (n: number) => Math.max(n, 10);
        const thenFn = (n: number) => Option.fromCoercible(0 * n / 0.00);
        const res = some.map(mapFn).andThen(thenFn);

        type AndThenParamReturnType = ReturnType<
          Parameters<typeof some["andThen"]>[0]
        >;

        assertType<
          IsOption<AndThenParamReturnType>
        >(true);
        assertType<
          IsNullable<SomeType<AndThenParamReturnType>>
        >(false);

        assertStrictEquals(res.unwrap(), undefined);
        assertStrictEquals(res.isNone(), true);
      },
    );

    await t.step(".andThen() -> flattens nested Options", () => {
      function greaterThanTen(n: number): Option<number> {
        return n > 10 ? Some(n) : None;
      }

      const big = Option(100);
      const nested = Option(big);

      const flattened = nested
        .andThen(Option.id<number>)
        .andThen(greaterThanTen);

      assertStrictEquals(flattened.isSome(), true);
    });

    await t.step(".orElse() -> is a noop", () => {
      const some = Option(1);

      const same = some.orElse(() => Some(2));

      assertStrictEquals(same, some);
      assertStrictEquals(same.unwrap(), some.unwrap());
    });

    await t.step(
      ".andEnsure() -> returns original instance of Some<T> if ensureFn succeeds",
      () => {
        const some = Some(1);

        const ensureFn = (n: number) => n === 1 ? Some.empty() : None;

        const same = some.andEnsure(ensureFn);

        assertStrictEquals(same, some);
        assertStrictEquals(same.unwrap(), some.unwrap());
      },
    );

    await t.step(".andEnsure() -> returns None if ensureFn fails", () => {
      const some = Some(1);

      const ensureFn = (n: number) => n === 1 ? None : Some.empty();

      const same = some.andEnsure(ensureFn);

      assertStrictEquals(same, None);
    });

    await t.step(
      ".zip() -> returns None if RHS is None",
      () => {
        const lhs = Some("thing");
        const rhs = None as Option<number>;

        const res = lhs.zip(rhs);

        assertStrictEquals(res.isNone(), true);
        assertStrictEquals(res.unwrap(), undefined);
      },
    );
  });

  await t.step("Some<T> -> Unwrap Methods", async (t) => {
    await t.step(
      ".unwrap() -> returns the wrapped value, type is T or Nullish union (T | undefined)",
      () => {
        const toBeWrapped = { some: "thing" };
        const some = Some(toBeWrapped);
        const maybeStr = Option.from("something" as string | undefined);

        function expect<T>(o: Option<T>): T {
          if (o.isNone()) {
            throw TypeError("Expected Some. Received: None!");
          }
          return o.unwrap();
        }

        function makeLoud(str: string): string {
          return str.toUpperCase().concat("!!!");
        }

        const unwrapped = some.unwrap();
        const res = makeLoud(expect(maybeStr));

        assertExists(unwrapped);
        assertExists(res);
        assertStrictEquals(unwrapped, toBeWrapped);
        assertStrictEquals(res, "SOMETHING!!!");

        const someTyped = Some(123);
        const someRes = someTyped.unwrap();
        const opt = Option.from(123 as number | undefined);
        const optRes = opt.unwrap();

        assertType<
          IsNullable<typeof someRes>
        >(false);
        assertType<
          IsNullable<typeof optRes>
        >(true);
        assertType<
          IsExact<typeof optRes, number | undefined>
        >(true);

        assertStrictEquals(someRes, optRes);
      },
    );

    await t.step(
      ".unwrapOr() -> returns the wrapped value, type is T or union (T | U)",
      () => {
        const toBeWrapped = { some: "thing" };
        const defaultValue = {};
        const some = Some(toBeWrapped);

        const unwrapped = some.unwrapOr(defaultValue);

        assertExists(unwrapped);
        assertNotEquals(unwrapped, defaultValue);
        assertNotStrictEquals(unwrapped, defaultValue);
        assertStrictEquals(unwrapped, toBeWrapped);

        const someTyped = Some(123);
        const someRes = someTyped.unwrapOr("123" as string);
        const opt = Option.from(123 as number | undefined);
        const optRes = opt.unwrapOr("123" as string);

        assertType<
          IsNullable<typeof someRes>
        >(false);
        assertType<
          IsExact<typeof someRes, number>
        >(true);
        assertType<
          IsNullable<typeof optRes>
        >(false);
        assertType<
          IsExact<typeof optRes, number | string>
        >(true);

        assertStrictEquals(someRes, optRes);
      },
    );

    await t.step(
      ".unwrapOrElse() -> returns the wrapped value, type is T or union (T | U)",
      () => {
        const toBeWrapped = { some: "thing" };
        const defaultFn = () => ({});
        const some = Some(toBeWrapped);

        const unwrapped = some.unwrapOrElse(defaultFn);

        assertExists(unwrapped);
        assertNotEquals(unwrapped, defaultFn());
        assertNotStrictEquals(unwrapped, defaultFn());
        assertStrictEquals(unwrapped, toBeWrapped);

        const someTyped = Some(123);
        const someRes = someTyped.unwrapOrElse(() => "123" as string);
        const opt = Option.from(123 as number | undefined);
        const optRes = opt.unwrapOrElse(() => "123" as string);

        assertType<
          IsNullable<typeof someRes>
        >(false);
        assertType<
          IsExact<typeof someRes, number>
        >(true);
        assertType<
          IsNullable<typeof optRes>
        >(false);
        assertType<
          IsExact<typeof optRes, number | string>
        >(true);

        assertStrictEquals(someRes, optRes);
      },
    );
  });

  await t.step("Some<T> -> Transformation Methods", async (t) => {
    await t.step(
      ".into() -> provides Some<T> to the supplied intoFn",
      async () => {
        const some = Some("thing");
        const promise = some.into((o) => Promise.resolve(o));

        const same = await promise;

        assertStrictEquals(same, some);
      },
    );

    await t.step(
      ".okOr() -> passes the encapsulated value by reference to the Ok constructor",
      () => {
        const rec = { some: "thing" };
        const some = Some(rec);

        const unreachable = Error("This is unreachable!");
        const res = some.okOr(unreachable);

        assertStrictEquals(res.isOk(), true);
        assertStrictEquals(res.unwrap(), rec);
      },
    );

    await t.step(
      ".okOrElse() -> passes the encapsulated value by reference to the Ok constructor",
      () => {
        const rec = { some: "thing" };
        const some = Some(rec);

        function unreachable() {
          const err = Error("This function call is unreachable!");
          throw err;
        }

        const res = some.okOrElse(unreachable);

        assertStrictEquals(res.isOk(), true);
        assertStrictEquals(res.unwrap(), rec);
      },
    );

    await t.step(
      ".iter() -> yields the wrapped value once then exhausts",
      () => {
        const some = Some(42);

        const iter = some.iter();
        const first = iter.next();
        const exhausted = iter.next();

        assertStrictEquals(first.done, false);
        assertStrictEquals(first.value, 42);
        assertStrictEquals(exhausted.done, true);
        assertStrictEquals(exhausted.value, undefined);
      },
    );
  });

  await t.step("Some<T> -> Convenience Methods", async (t) => {
    await t.step(
      ".tap() -> tapFn calling instance of Option",
      () => {
        const createTapFn = function <T>(
          originalValue: T,
          originalOption: Option<T>,
        ): (opt: Option<T>) => void {
          return (opt: Option<T>) => {
            assertStrictEquals(originalValue, opt.unwrap());
            assertStrictEquals(originalOption, opt);
            assertEquals(originalValue, opt.unwrap());
          };
        };

        const originalValue = { some: "thing" };
        const originalOption = Some(originalValue);
        const tapAssertionFn = createTapFn(originalValue, originalOption);

        const returnedOption = originalOption.tap(tapAssertionFn);

        assertStrictEquals(returnedOption, originalOption);
      },
    );

    await t.step(
      ".inspect() -> passes the encapsulated value by reference",
      () => {
        const createInspectFn = function <T>(
          originalValue: T,
        ): (value: T) => void {
          return (value: T) => {
            assertStrictEquals(originalValue, value);
          };
        };

        const originalValue = { some: "thing" };
        const originalOption = Some(originalValue);
        const inspectAssertionFn = createInspectFn(originalValue);

        const returnedOption = originalOption.inspect(inspectAssertionFn);

        assertStrictEquals(returnedOption, originalOption);
      },
    );

    await t.step(
      ".toTag() -> is short-hand for Object.prototype.toString.call(Some(value))",
      () => {
        const some = Some("thing");

        const tag = some.toTag();
        const objTag = Object.prototype.toString.call(some);

        assertStrictEquals(tag, objTag);
      },
    );
  });

  await t.step("Some<T> -> JS well-known Symbols and Methods", async (t) => {
    await t.step(
      "[Symbol.hasInstance]() -> instanceof returns true for instances of Some",
      () => {
        allNonNullish.forEach((value) => {
          const some = Some(value);
          const ref = value;

          const isSomeInstance = some instanceof Some;
          const isOptionInstance = some instanceof Option;
          const isNotInstance = !(ref instanceof Some);

          assertStrictEquals(isSomeInstance, true);
          assertStrictEquals(isOptionInstance, true);
          assertStrictEquals(isNotInstance, true);
        });

        const noneNeverIsInstanceOfSome = !(None instanceof Some);

        assertStrictEquals(noneNeverIsInstanceOfSome, true);
      },
    );

    await t.step(
      "[Symbol.toStringTag]() -> returns FQN and is not nullish",
      () => {
        const someStr = Some("abc");
        const someArr = Some([1, 2, 3]);
        const someRec = Some({ [Symbol.toStringTag]: "TestRecord" });

        //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag
        const resStatic = Object.prototype.toString.call(Some);
        const resStr = Object.prototype.toString.call(someStr);
        const resArr = Object.prototype.toString.call(someArr);
        const resRec = Object.prototype.toString.call(someRec);

        assertStrictEquals(resStatic, "[object grugway.Option.Some]");
        assertStrictEquals(resStr, "[object grugway.Option.Some<abc>]");
        assertStrictEquals(
          resArr,
          "[object grugway.Option.Some<[object Array]>]",
        );
        assertStrictEquals(
          resRec,
          "[object grugway.Option.Some<[object TestRecord]>]",
        );
      },
    );

    await t.step(
      "[Symbol.iterator]() -> supports spread operator, conforms iterator protocol, and correctly infers delegation",
      () => {
        const num = Some(2);
        const arr = Some([1, 2, 3]);
        const rec = Some({ a: 1 });
        const recNested = { a: 1, num, arr, rec };

        const copy = { ...recNested };
        const copyInner = { ...rec }; // Hint: plain objects don't implement Symbol.iterator
        const copyInnerUnwrapped = { ...(rec.unwrap()) };
        const arrCopy = [...arr];
        const iterResNum = num[Symbol.iterator]().next();
        const iterResRec = rec[Symbol.iterator]().next();

        assertEquals(copy, {
          a: 1,
          num: Some(2),
          arr: Some([1, 2, 3]),
          rec: Some({ a: 1 }),
        });
        assertEquals(copyInner, {});
        assertEquals(copyInnerUnwrapped, { a: 1 });
        assertEquals(arrCopy, [1, 2, 3]);
        assertEquals(iterResNum, { done: true, value: undefined });
        assertEquals(iterResRec, { done: true, value: undefined });

        // Type-level delegation tests
        class MyIterable implements Iterable<number> {
          #value: number;
          constructor(value: number) {
            this.#value = value;
          }
          *[Symbol.iterator]() {
            yield this.#value;
          }
        }

        const someArr = Some([1, 2, 3]);
        const someStr = Some("thing");
        const someNum = Some(42);
        const someIter = Some(new MyIterable(123));

        const someArrIter = someArr[Symbol.iterator]();
        const someStrIter = someStr[Symbol.iterator]();
        const someNumIter = someNum[Symbol.iterator]();
        const someIterIter = someIter[Symbol.iterator]();

        assertType<IsExact<typeof someArrIter, IterableIterator<number>>>(true);
        assertType<IsExact<typeof someStrIter, IterableIterator<string>>>(true);
        assertType<IsExact<typeof someNumIter, IterableIterator<never>>>(true);
        assertType<IsExact<typeof someIterIter, IterableIterator<number>>>(
          true,
        );
      },
    );

    await t.step(
      "[Symbol.toPrimitve]() -> supports all hints and delegates to the underlying implementation",
      () => {
        const defaultHint = "default";
        const stringHint = "string";
        const numberHint = "number";
        allNonNullish.filter((value) => !Number.isNaN(value)).forEach(
          (value) => {
            const some = Some(value);
            const ref = Object(value);

            if (Symbol.toPrimitive in ref) {
              const someDefaultCoercion = some[Symbol.toPrimitive](defaultHint);
              const refDefaultCoercion = ref[Symbol.toPrimitive](defaultHint);
              const someStringCoercion = some[Symbol.toPrimitive](stringHint);
              const refStringCoercion = ref[Symbol.toPrimitive](stringHint);
              const someNumberCoercion = some[Symbol.toPrimitive](numberHint);
              const refNumberCoercion = ref[Symbol.toPrimitive](numberHint);

              assertStrictEquals(someDefaultCoercion, refDefaultCoercion);
              assertStrictEquals(someStringCoercion, refStringCoercion);
              assertStrictEquals(someNumberCoercion, refNumberCoercion);
            }
          },
        );
      },
    );

    await t.step(
      ".toJSON() -> delegates to underlying implementation or returns the value itself",
      () => {
        /**
         * Arrange non-nullish values which can be stringified
         */
        allNonNullish
          .filter((value) => {
            if (typeof value === "bigint") return false;
            if (typeof value === "number" && Number.isNaN(value)) return false;
            return true;
          }).forEach(
            (value) => {
              const someJson = JSON.stringify(Some(value));
              const refJson = JSON.stringify(value);

              assertStrictEquals(someJson, refJson);
            },
          );
      },
    );

    await t.step(
      ".toString() -> delegates to underlying implementation",
      () => {
        allNonNullish.forEach((value) => {
          const someStr = Some(value).toString();
          const str = Object(value).toString();

          assertStrictEquals(someStr, str);
        });
      },
    );

    await t.step(".valueOf() -> delegates to underlying implementation", () => {
      allNonNullish.forEach((value) => {
        const someVal = Some(value).valueOf();
        const val = Object(value).valueOf();

        assertStrictEquals(someVal, val);
      });
    });
  });

  await t.step("Some<T> -> Coercions", async (t) => {
    /**
     * Implicit coercions make the JavaScript world go round, but are
     * a constant source of error, confusion and frustration.
     * Luckily, the transpiler will flag most occurences of implicit coercion
     * where a primitive value is expected as error.
     * The following steps are meant to demonstrate and document the
     * behavior of Some<T> in these situations, given a wrapped value
     * of type T.
     * NEVER RELY on this behavior though, it's confusing!
     * USE EXPLICIT methods or default values instead.
     * DISREGARD THIS ADVICE AT YOUR OWN PERIL.
     */
    await t.step(
      'Primitive coercion -> delegates to underlying implementation (ops: binary "+" [string concatenation & addition], loose equality, Date constructor)',
      () => {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#primitive_coercion
        const primitiveStr = "This is " +
          Some("nice, but still ") + Some({ weird: "behaviour." });
        //@ts-ignore-lines for testing purposes
        const primitiveSum = 42 + Some(41);
        //@ts-ignore-lines for testing purposes
        const primitiveCmp = 0 == Some(false);
        //@ts-ignore-lines for testing purposes
        const primitiveDate = new Date(Some(false));
        //@ts-ignore-lines for testing purposes
        const thisIsReallyFunny = 0 == Some(None);

        const expectedStr = "This is nice, but still [object Object]"; // coerces to the underlying primitive representations
        const expectedSum = 83; // coerces to the underlying primitive
        const expectedCmp = true; // also here, but false is further coerced to 0 (LOLse equality... what a joke)
        const expectedDate = new Date(0); //Again, false is further coerced to 0

        assertStrictEquals(primitiveStr, expectedStr);
        assertStrictEquals(primitiveSum, expectedSum);
        assertStrictEquals(primitiveCmp, expectedCmp);
        assertStrictEquals(primitiveDate.toString(), expectedDate.toString());
        assertStrictEquals(thisIsReallyFunny, true);
      },
    );

    await t.step(
      "String coercion -> delegates to underlying implementation (ops: template literal, String constructor)",
      () => {
        /**
         * Arrange non-nullish values which can actually be further coerced.
         * Symbols are the only primitive values, where no further coercion can be performed.
         * Therefore Some<Symbol> behaves exactly as Symbol in these situations.
         * ```
         * const sym = Symbol("test");
         * const someSym = Some(sym);
         *
         * assertThrows(() => String(sym));
         * assertThrows(() => String(someSym));
         * ```
         */
        allNonNullish
          .filter((value) => value !== sym)
          .forEach((value) => {
            const some = Some(value);
            const ref = Object(value);

            const tmpl = `${some}`;
            const ctor = String(some);

            const expected = ref.toString();

            assertStrictEquals(tmpl, expected);
            assertStrictEquals(ctor, expected);
          });
      },
    );

    await t.step(
      'Number coercion -> delegates to underlying implementation (ops: unary "+" and Number constructor)',
      () => {
        const sumRhsPlus = 41 + +Some(1);
        const sumLhsPlus = +Some("1") + 41;

        const diffRhsPlus = 43 - +Some(1);
        const diffLhsPlus = +Some("1") - -41;

        const prodRhsPlus = 42 * +Some(1);
        const prodLhsPlus = +Some("1") * 42;

        const quotRhsPlus = 42 / +Some(1);
        const quotLhsPlus = +Some("1") / (1 / 42);

        const sumRhsCtor = 41 + Number(Some(1));
        const sumLhsCtor = Number(Some("1")) + 41;

        const diffRhsCtor = 43 - Number(Some(1));
        const diffLhsCtor = Number(Some("1")) - -41;

        const prodRhsCtor = 42 * Number(Some(1));
        const prodLhsCtor = Number(Some("1")) * 42;

        const quotRhsCtor = 42 / Number(Some(1));
        const quotLhsCtor = Number(Some("1")) / (1 / 42);

        assertStrictEquals(sumRhsPlus, 42);
        assertStrictEquals(sumLhsPlus, 42);
        assertStrictEquals(sumRhsCtor, 42);
        assertStrictEquals(sumLhsCtor, 42);
        assertStrictEquals(diffRhsPlus, 42);
        assertStrictEquals(diffLhsPlus, 42);
        assertStrictEquals(diffRhsCtor, 42);
        assertStrictEquals(diffLhsCtor, 42);
        assertStrictEquals(prodRhsPlus, 42);
        assertStrictEquals(prodLhsPlus, 42);
        assertStrictEquals(prodRhsCtor, 42);
        assertStrictEquals(prodLhsCtor, 42);
        assertStrictEquals(quotRhsPlus, 42);
        assertStrictEquals(quotLhsPlus, 42);
        assertStrictEquals(quotRhsCtor, 42);
        assertStrictEquals(quotLhsCtor, 42);
      },
    );
  });
});

Deno.test("grugway::Option::None", async (t) => {
  await t.step("None -> Is a frozen contant", () => {
    const isFrozen = Object.isFrozen(None);

    assertStrictEquals(isFrozen, true);
  });
  await t.step("None -> Type Predicates", async (t) => {
    await t.step(".isSome() -> returns false", () => {
      const isSome = None.isSome();

      assertStrictEquals(isSome, false);
    });

    await t.step(".isNone() -> returns true", () => {
      const isNone = None.isNone();

      assertStrictEquals(isNone, true);
    });
  });

  await t.step("None -> Logical Combinators (&&, ||, ^)", async (t) => {
    await t.step(".and() -> returns LHS", () => {
      const lhs = None;
      const rhs = Some("thing");

      const res = lhs.and(rhs);

      assertStrictEquals(res, lhs);
      assertStrictEquals(res.unwrap(), lhs.unwrap());
    });

    await t.step(".or() -> returns RHS", () => {
      const lhs = None;
      const rhs = Some("thing");

      const res = lhs.or(rhs);

      assertStrictEquals(res, rhs);
      assertStrictEquals(res.unwrap(), rhs.unwrap());
    });

    await t.step(".xor() -> returns RHS if LHS is None", () => {
      const lhs = None;
      const rhs = Some("thing");

      const res = lhs.xor(rhs);

      assertStrictEquals(res, rhs);
      assertStrictEquals(res.unwrap(), rhs.unwrap());
    });

    await t.step(".xor() -> returns None if LHS and RHS are None", () => {
      const lhs = None;
      const rhs = None;

      const res = lhs.xor(rhs);

      assertStrictEquals(res, None);
      assertStrictEquals(res.unwrap(), undefined);
    });

    await t.step(
      ".and().or().xor() -> chaining returns the equivalent result as logical operations on coercible values",
      () => {
        const lhs = None;
        const rhs1 = None;
        const rhs2 = None;
        const rhs3 = Some("thing");

        const res = lhs.and(rhs1).or(rhs2).xor(rhs3);
        /**
         * here xor is actually a bitwise operator, but since
         * 0 and 1 are coercible to false and true respectively,
         * we can use this to emulate the non-exisitng logical
         * xor operator.
         */
        const equivalent = ((0 && 0) || 0) ^ 1;

        assertStrictEquals(equivalent, 1);
        assertStrictEquals(res.isSome(), Boolean(equivalent));
        assertStrictEquals(res, rhs3);
        assertStrictEquals(res.unwrap(), "thing");
      },
    );
  });

  await t.step("None -> Map Methods", async (t) => {
    await t.step(
      ".map() -> returns None",
      () => {
        const double = (x: number) => x * 2;

        const maybeDoubled = None.map(double);

        assertType<IsExact<typeof maybeDoubled, None>>(true);
        assertStrictEquals(maybeDoubled, None);
      },
    );

    await t.step(
      ".mapOr() -> returns new instance of Some with supplied orValue",
      () => {
        const double = (x: number) => new Date(x * 2);
        const orValue = new Date();

        const maybeDoubled = None.mapOr(double, orValue);

        assertStrictEquals(maybeDoubled instanceof Some, true);
        assertStrictEquals(maybeDoubled.unwrap(), orValue);
      },
    );

    await t.step(
      ".mapOrElse() -> returns new instance of Some with the result of supplied orFn",
      () => {
        const ref = new Date(1431648000000);
        const double = (x: number) => new Date(x * 2);
        const orFn = () => ref;

        const maybeDoubled = None.mapOrElse(double, orFn);

        assertStrictEquals(maybeDoubled instanceof Some, true);
        assertStrictEquals(maybeDoubled.unwrap(), ref);
      },
    );

    await t.step(".zip() -> returns None regardless of RHS", () => {
      const some = Some("thing");

      const noneZipSome = None.zip(some);
      const noneZipNone = None.zip(None);

      assertStrictEquals(noneZipSome, None);
      assertStrictEquals(noneZipNone, None);
    });

    await t.step(
      ".filter() -> accepts a type guard and narrows type",
      () => {
        const numOrStr = 0 as string | number;
        const isNum = (value: unknown): value is number =>
          typeof value === "number";

        const none = Option.fromCoercible(numOrStr);
        const same = none.filter(isNum);

        assertType<
          IsExact<typeof none, Option<string | number>>
        >(true);
        assertType<
          IsExact<typeof same, Option<number>>
        >(true);

        assertStrictEquals(same, none);
        assertStrictEquals(same.isNone(), true);
      },
    );

    await t.step(".filter() -> returns None", () => {
      const num = 0;
      const isEven = (value: number): boolean => value % 2 === 0;

      const none = Option.fromCoercible(num);
      const same = none.filter(isEven);

      assertStrictEquals(same, none);
      assertStrictEquals(same.isNone(), true);

      const noneDirectFilter = None.filter(isEven);

      assertType<IsExact<typeof noneDirectFilter, None>>(true);

      assertStrictEquals(noneDirectFilter.isNone(), true);
    });

    await t.step(".andThen() -> returns None", () => {
      const double = (x: number) => Option(x * 2);

      const maybeDoubled = None.andThen(double);

      assertStrictEquals(maybeDoubled, None);
      assertStrictEquals(maybeDoubled.unwrap(), undefined);
    });

    await t.step(".orElse() -> returns new Option instance", () => {
      const fallback = () => Option(42);

      const maybeFallback = None.orElse(fallback);

      assertStrictEquals(maybeFallback.isSome(), true);
      assertStrictEquals(maybeFallback.unwrap(), 42);
    });

    await t.step(".andEnsure() -> is a no-op", () => {
      let gotCalled = false;
      const ensureFn = () => {
        gotCalled = true;
        return Option(42);
      };
      const opt = Option.fromCoercible(0);

      const same = opt.andEnsure(ensureFn);

      assertStrictEquals(gotCalled, false);
      assertStrictEquals(same, opt);
    });
  });

  await t.step("None -> Unwrap Methods", async (t) => {
    await t.step(".unwrap() -> returns undefined", () => {
      const unwrapped = None.unwrap();

      assertStrictEquals(unwrapped, undefined);
    });

    await t.step(".unwrapOr() -> returns the orValue", () => {
      const orValue = {};

      const unwrapped = None.unwrapOr(orValue);

      assertStrictEquals(unwrapped, orValue);
    });

    await t.step(".unwrapOrElse() -> returns the result of orFn", () => {
      const ref = new Date();
      const orFn = () => ref;

      const unwrapped = None.unwrapOrElse(orFn);

      assertStrictEquals(unwrapped, orFn());
    });
  });

  await t.step("None -> Transformation Methods", async (t) => {
    await t.step(".into() -> supplies None to the provided function", () => {
      type Either<L, R> = { tag: "Left"; value: L } | {
        tag: "Right";
        value: R;
      };
      function eitherFromOption(o: Option<number>): Either<number, undefined> {
        if (o.isNone()) return { tag: "Right", value: undefined };
        return { tag: "Left", value: o.unwrap() };
      }

      const maybeNumber = Option.fromCoercible(0);
      const either = maybeNumber.into(eitherFromOption);

      assertStrictEquals(either.tag, "Right");
    });

    await t.step(
      ".okOr() -> returns an instance of Err wrapping the provided value",
      () => {
        const opt = Option.fromCoercible("");
        const typeErr = TypeError("Cannot operate on empty string");

        const res = opt.okOr(typeErr);

        assertStrictEquals(res.isErr(), true);
        assertStrictEquals(res.unwrap(), typeErr);
      },
    );

    await t.step(
      ".okOrElse() -> returns an instance of Err wrapping the result of the provided fn",
      () => {
        const opt = Option.fromCoercible("");
        const typeErr = TypeError("Cannot operate on empty string");
        const elseFn = () => typeErr;

        const res = opt.okOrElse(elseFn);

        assertStrictEquals(res.isErr(), true);
        assertStrictEquals(res.unwrap(), typeErr);
      },
    );

    await t.step(
      ".iter() -> returns an exhausted iterator",
      () => {
        const iter = None.iter();
        const first = iter.next();

        assertStrictEquals(first.done, true);
        assertStrictEquals(first.value, undefined);
      },
    );
  });

  await t.step("None -> Convenience Methods", async (t) => {
    await t.step(
      ".tap() -> tapFn receives None",
      () => {
        const tapFn = <T>(opt: Option<T>) => {
          assertStrictEquals(opt, None);
        };

        const originalOption = None;

        const returnedOption = originalOption.tap(tapFn);

        assertStrictEquals(returnedOption, originalOption);
      },
    );

    await t.step(".inspect() -> is a no-op", () => {
      let gotCalled = false;
      const toggle = () => {
        gotCalled = true;
      };

      None.inspect(toggle);

      assertStrictEquals(gotCalled, false);
    });

    await t.step(
      ".toTag() -> is short-hand for Object.prototype.toString.call(None)",
      () => {
        const tag = None.toTag();
        const objTag = Object.prototype.toString.call(None);

        assertStrictEquals(tag, objTag);
      },
    );

    await t.step(".id() -> returns None", () => {
      const same = None.id();

      assertStrictEquals(same, None);
      assertStrictEquals(same.isNone(), true);
    });

    await t.step(".clone() -> returns None", () => {
      const cloned = None.clone();

      assertStrictEquals(cloned, None);
      assertStrictEquals(cloned.isNone(), true);
    });
  });

  await t.step("None -> JS well-known Symbols and Methods", async (t) => {
    await t.step(
      "[Symbol.hasInstance]() -> instanceof returns true for instances of None",
      () => {
        allFalsy.forEach((value) => {
          const none = Option.fromCoercible(value);
          const ref = Object(value);

          // Typescript doesn't conform the ECMA spec here:
          // https://github.com/microsoft/TypeScript/issues/39064
          //deno-lint-ignore no-explicit-any
          const isNoneInstance = none instanceof (None as any);
          const isOptionInstance = none instanceof Option;
          //deno-lint-ignore no-explicit-any
          const isNotNoneInstance = !(ref instanceof (None as any));

          assertStrictEquals(isNoneInstance, true);
          assertStrictEquals(isOptionInstance, true);
          assertStrictEquals(isNotNoneInstance, true);
        });

        const some = Some("thing");

        //deno-lint-ignore no-explicit-any
        const someIsNeverNoneInstance = !(some instanceof (None as any));

        assertStrictEquals(someIsNeverNoneInstance, true);
      },
    );

    await t.step(
      "[Symbol.toStringTag]() -> returns FQN and is not nullish",
      () => {
        //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag
        const res = Object.prototype.toString.call(None);

        assertExists(res);
        assertStrictEquals(res, "[object grugway.Option.None]");
      },
    );

    await t.step(
      "[Symbol.iterator]() -> supports spread operator and conforms iterator protocol",
      () => {
        const rec = { a: 1, b: None };
        const none = Option.from(undefined);

        const loop = () => {
          let count = 0;
          for (const _item of None) {
            count += 1;
          }
          return count;
        };
        const copy = { ...rec };
        const recSppread = { ...none };
        const arrSpread = [...none];
        const iterCount = loop();
        const iterRes = None[Symbol.iterator]().next();

        assertObjectMatch(copy, { a: 1 });
        assertObjectMatch(recSppread, {});
        assertEquals(arrSpread, []);
        assertStrictEquals(iterCount, 0);
        assertObjectMatch(iterRes, { done: true, value: undefined });
      },
    );

    await t.step(
      "[Symbol.toPrimitve]() -> supports all hints and returns falsy defaults",
      () => {
        const str = None[Symbol.toPrimitive]("string");
        const num = None[Symbol.toPrimitive]("number");
        const def = None[Symbol.toPrimitive]("default");

        assertStrictEquals(str, "");
        assertStrictEquals(num, 0);
        assertStrictEquals(def, false);
      },
    );

    await t.step(
      ".toJSON() -> returns undefined, thus being stripped by JSON.stringify()",
      () => {
        const def = None.toJSON();
        const str = JSON.stringify(None);
        const rec = { a: "a", b: None };
        const recStr = JSON.stringify(rec);

        assertStrictEquals(def, undefined);
        assertStrictEquals(str, undefined);
        assertStrictEquals(recStr, '{"a":"a"}');
      },
    );

    await t.step(".toString() -> returns empty string", () => {
      const str = None.toString();

      assertStrictEquals(str, "");
    });

    await t.step(".valueOf() -> returns 0", () => {
      const num = None.valueOf();

      assertStrictEquals(num, 0);
    });
  });

  await t.step("None -> Coercions", async (t) => {
    await t.step(
      'Primitive coercion -> returns false (ops: binary "+" [string concatenation & addition], loose equality, Date constructor)',
      () => {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#primitive_coercion
        const primitiveStr = "This is " + None;
        //@ts-ignore-lines for testing purposes
        const primitiveSum = None + 42;
        //@ts-ignore-lines for testing purposes
        const primitiveCmp = 0 == None;
        //@ts-ignore-lines for testing purposes
        const primitiveDate = new Date(None);

        const expectedStr = "This is false"; // false is further coerced to string
        const expectedSum = 42; // false is further coerced to 0
        const expectedCmp = true; // false is further coerced to 0
        const expectedDate = new Date(0); //Again, false is further coerced to 0

        assertStrictEquals(primitiveStr, expectedStr);
        assertStrictEquals(primitiveSum, expectedSum);
        assertStrictEquals(primitiveCmp, expectedCmp);
        assertStrictEquals(primitiveDate.toString(), expectedDate.toString());
      },
    );

    await t.step(
      "String coercion -> returns empty string (ops: template literal, String constructor)",
      () => {
        const tmpl = `This is ${None}`;
        const ctor = "This is " + String(None);

        const expected = "This is ";

        assertStrictEquals(tmpl, expected);
        assertStrictEquals(ctor, expected);
      },
    );

    await t.step(
      'Number coercion -> returhs 0 (ops: unary "+" and Number constructor)',
      () => {
        const sumRhsPlus = 42 + +None;
        const sumLhsPlus = +None + 42;

        const diffRhsPlus = 42 - +None;
        const diffLhsPlus = +None - 42;

        const prodRhsPlus = 42 * +None;
        const prodLhsPlus = +None * 42;

        const quotRhsPlus = 42 / +None;
        const quotLhsPlus = +None / 42;

        const sumRhsCtor = 42 + Number(None);
        const sumLhsCtor = Number(None) + 42;

        const diffRhsCtor = 42 - Number(None);
        const diffLhsCtor = Number(None) - 42;

        const prodRhsCtor = 42 * Number(None);
        const prodLhsCtor = Number(None) * 42;

        const quotRhsCtor = 42 / Number(None);
        const quotLhsCtor = Number(None) / 42;

        assertStrictEquals(sumRhsPlus, 42);
        assertStrictEquals(sumLhsPlus, 42);
        assertStrictEquals(sumRhsCtor, 42);
        assertStrictEquals(sumLhsCtor, 42);
        assertStrictEquals(diffRhsPlus, 42);
        assertStrictEquals(diffLhsPlus, -42);
        assertStrictEquals(diffRhsCtor, 42);
        assertStrictEquals(diffLhsCtor, -42);
        assertStrictEquals(prodRhsPlus, 0);
        assertStrictEquals(prodLhsPlus, 0);
        assertStrictEquals(prodRhsCtor, 0);
        assertStrictEquals(prodLhsCtor, 0);
        assertStrictEquals(quotRhsPlus, Infinity);
        assertStrictEquals(quotLhsPlus, 0);
        assertStrictEquals(quotRhsCtor, Infinity);
        assertStrictEquals(quotLhsCtor, 0);
      },
    );
  });
});
