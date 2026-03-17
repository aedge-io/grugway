import { assertEquals, assertStrictEquals } from "@std/assert";
import type { IsExact } from "@std/testing/types";
import { assertType } from "@std/testing/types";
import { Err, Ok, Result } from "./result.ts";
import {
  all,
  any,
  type InferredErrTuple,
  type InferredErrUnion,
  type InferredOkTuple,
  type InferredOkUnion,
} from "./results.ts";

Deno.test("grugway::Results", async (t) => {
  await t.step(".all() -> collects Ok values into an array", () => {
    const collection: Result<number, Error>[] = Array(5).fill(0).map((v, i) =>
      Ok(v + i)
    );

    const areOk = all(collection);

    assertType<IsExact<typeof areOk, Result<number[], Error>>>(true);
    assertStrictEquals(areOk.isOk(), true);
    assertEquals(areOk.unwrap(), [0, 1, 2, 3, 4]);
  });

  await t.step(
    ".all() -> returns the first instance of Err if present in iterable",
    () => {
      const err = Err(TypeError("This is the one"));
      const secondErr = Err(TypeError("This is the second one"));
      const collection = [Ok(42), Ok(17), err, Ok(3), secondErr];

      const result = all(collection);

      assertType<IsExact<typeof result, Result<number[], TypeError>>>(true);
      assertStrictEquals(result.isErr(), true);
      assertStrictEquals(result, err);
    },
  );

  await t.step(".all() -> returns the correct type when used on tuples", () => {
    const str = Ok("str") as Result<string, TypeError>;
    const num = Ok(123) as Result<number, RangeError>;
    const bool = Ok(true) as Result<boolean, Error>;
    const tuple = [str, num, bool] as const;

    const result = all(tuple);

    assertType<
      IsExact<
        typeof result,
        Result<
          readonly [string, number, boolean],
          TypeError | RangeError | Error
        >
      >
    >(true);
    assertStrictEquals(result.isOk(), true);
    assertEquals(result.unwrap(), ["str", 123, true]);
  });

  await t.step(".any() -> collects all Err values into an array", () => {
    const collection: Result<string, number>[] = Array(5).fill(0).map((v, i) =>
      Err(v + i)
    );

    const areErr = any(collection);

    assertType<IsExact<typeof areErr, Result<string, number[]>>>(true);
    assertStrictEquals(areErr.isErr(), true);
    assertEquals(areErr.unwrap(), [0, 1, 2, 3, 4]);
  });

  await t.step(
    ".any() -> returns the first instance of Ok if present in iterable",
    () => {
      const success = Ok("this is the one");
      const secondSuccess = Ok("this is the second one");
      const collection = [
        Err(TypeError()),
        Err(TypeError()),
        success,
        Err(TypeError()),
        secondSuccess,
      ];

      const result = any(collection);

      assertType<IsExact<typeof result, Result<string, TypeError[]>>>(true);
      assertStrictEquals(result.isOk(), true);
      assertStrictEquals(result, success);
    },
  );

  await t.step(".any() -> returns the correct type when used on tuples", () => {
    const str = Ok("str") as Result<string, TypeError>;
    const num = Ok(123) as Result<number, RangeError>;
    const bool = Ok(true) as Result<boolean, Error>;
    const tuple = [str, num, bool] as const;

    const result = any(tuple);

    assertType<
      IsExact<
        typeof result,
        Result<
          string | number | boolean,
          readonly [TypeError, RangeError, Error]
        >
      >
    >(true);
    assertStrictEquals(result.isOk(), true);
    assertEquals(result.unwrap(), "str");
  });
});

Deno.test("grugway::Results::InferredTypes", async (t) => {
  await t.step("InferredOkTuple<R> -> maps inferred tuples correctly", () => {
    const one: Result<number, string> = Ok(1);
    const two: Result<boolean, Error> = Ok(true);
    const three: Result<string, TypeError> = Ok("str");
    const tuple = [one, two, three] as const;

    assertType<
      IsExact<InferredOkTuple<typeof tuple>, readonly [number, boolean, string]>
    >(true);
  });

  await t.step("InferredErrTuple<R> -> maps inferred tuples correctly", () => {
    const one: Result<number, string> = Err("1");
    const two: Result<boolean, Error> = Err(Error());
    const three: Result<string, TypeError> = Err(TypeError());
    const tuple = [one, two, three] as const;

    assertType<
      IsExact<
        InferredErrTuple<typeof tuple>,
        readonly [string, Error, TypeError]
      >
    >(true);
  });

  await t.step(
    "InferredOkUnion<R> -> maps inferred tuples correctly to union",
    () => {
      const one: Result<number, string> = Ok(1);
      const two: Result<boolean, Error> = Ok(true);
      const three: Result<string, TypeError> = Ok("str");
      const tuple = [one, two, three] as const;

      assertType<
        IsExact<InferredOkUnion<typeof tuple>, number | boolean | string>
      >(true);
    },
  );

  await t.step(
    "InferredErrUnion<R> -> maps inferred tuples correctly to union",
    () => {
      const one: Result<number, string> = Err("1");
      const two: Result<boolean, Error> = Err(Error());
      const three: Result<string, TypeError> = Err(TypeError());
      const tuple = [one, two, three] as const;

      assertType<
        IsExact<InferredErrUnion<typeof tuple>, string | Error | TypeError>
      >(true);
    },
  );
});
