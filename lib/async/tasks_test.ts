import type {
  InferredFailureTuple,
  InferredFailureType,
  InferredFailureUnion,
  InferredSuccessTuple,
  InferredSuccessType,
  InferredSuccessUnion,
} from "./tasks.ts";
import * as Tasks from "./tasks.ts";
import { Task } from "./task.ts";
import { Err, Ok } from "../core/result.ts";
import { assertEquals, assertStrictEquals } from "@std/assert";
import { assertType, type IsExact } from "@std/testing/types";

Deno.test("grugway::Tasks::InferredTypes", async (t) => {
  await t.step(
    "InferredSuccessType<P> -> infers encapsulated type <T> correctly",
    () => {
      const task = Task.succeed("str");

      assertType<IsExact<InferredSuccessType<typeof task>, string>>(true);
    },
  );

  await t.step(
    "InferredFailureType<P> -> infers encapsulated type <E> correctly",
    () => {
      const task = Task.fail(TypeError("This is the one"));

      assertType<IsExact<InferredFailureType<typeof task>, TypeError>>(true);
    },
  );

  await t.step(
    "InferredSuccessTuple<P> -> maps inferred tuples correctly",
    () => {
      const one = Task.succeed(1);
      const two = Task.succeed(true);
      const three = Task.fail("str");
      const tuple = [one, two, three] as const;

      assertType<
        IsExact<
          InferredSuccessTuple<typeof tuple>,
          readonly [number, boolean, never]
        >
      >(true);
    },
  );

  await t.step(
    "InferredFailureTuple<P> -> maps inferred tuples correctly",
    () => {
      const one = Task.fail("1");
      const two = Task.fail(Error());
      const three = Task.succeed(TypeError());
      const tuple = [one, two, three] as const;

      assertType<
        IsExact<
          InferredFailureTuple<typeof tuple>,
          readonly [string, Error, never]
        >
      >(true);
    },
  );

  await t.step(
    "InferredSuccessUnion<P> -> maps inferred tuples correctly to union",
    () => {
      const one = Task.succeed(1);
      const two = Task.succeed(true);
      const three = Task.succeed("str");
      const tuple = [one, two, three] as const;

      assertType<
        IsExact<InferredSuccessUnion<typeof tuple>, number | boolean | string>
      >(true);
    },
  );

  await t.step(
    "InferredFailureUnion<P> -> maps inferred tuples correctly to union",
    () => {
      const one = Task.fail("1");
      const two = Task.fail(Error());
      const three = Task.fail(TypeError());
      const tuple = [one, two, three] as const;

      assertType<
        IsExact<InferredFailureUnion<typeof tuple>, string | Error | TypeError>
      >(true);
    },
  );
});

Deno.test("grugway::Tasks", async (t) => {
  await t.step(".all() -> collects Ok values into an array", async () => {
    const collection: Task<number, Error>[] = Array(5).fill(0).map((v, i) =>
      Task.succeed(v + i)
    );

    const success = Tasks.all(collection);
    const ok = await success;

    assertType<IsExact<typeof success, Task<number[], Error>>>(true);
    assertEquals(ok.unwrap(), [0, 1, 2, 3, 4]);
  });

  await t.step(
    ".all() -> returns the first instance of Err if present in iterable",
    async () => {
      const error = Err(TypeError("This is the one"));
      const collection: Task<number, TypeError>[] = Array(5).fill(0).map(
        (v, i) => {
          if (i === 3) return Task.of(error);
          return Task.succeed(v + i);
        },
      );

      const task = Tasks.all(collection);
      const err = await task;

      assertType<IsExact<typeof task, Task<number[], TypeError>>>(true);
      assertStrictEquals(err.isErr(), true);
      assertStrictEquals(error, err);
    },
  );

  await t.step(
    ".all() -> returns the correct type when used on tuples",
    async () => {
      const str = Task.succeed("str") as Task<string, TypeError>;
      const num = Task.succeed(123) as Task<number, RangeError>;
      const bool = Task.succeed(true) as Task<boolean, Error>;
      const tuple = [str, num, bool] as const;

      const task = Tasks.all(tuple);
      const ok = await task;

      assertType<
        IsExact<
          typeof task,
          Task<
            readonly [string, number, boolean],
            TypeError | RangeError | Error
          >
        >
      >(true);
      assertStrictEquals(ok.isOk(), true);
      assertEquals(ok.unwrap(), ["str", 123, true]);
    },
  );

  await t.step(
    ".all() -> short-circuits on first Err",
    async () => {
      const error = Err(TypeError("fast failure"));
      let slowResolved = false;
      let timerId: number;

      const fast = Task.of(error) as Task<number, TypeError>;
      const slow: Task<number, TypeError> = Task.fromPromise(
        new Promise<number>((resolve) => {
          timerId = setTimeout(() => {
            slowResolved = true;
            resolve(99);
          }, 128);
        }),
        (e) => e instanceof TypeError ? e : TypeError("Unknown", { cause: e }),
      );

      const task = Tasks.all([fast, slow]);
      const err = await task;

      clearTimeout(timerId!);

      assertType<IsExact<typeof task, Task<number[], TypeError>>>(true);
      assertStrictEquals(err.isErr(), true);
      assertStrictEquals(err.unwrap(), error.unwrap());
      assertStrictEquals(slowResolved, false);
    },
  );

  await t.step(
    ".all() -> calls abort on the provided AbortController on first Err",
    async () => {
      const controller = new AbortController();
      const error = Err(TypeError("boom"));

      const fast = Task.of(error) as Task<number, TypeError>;
      const slow: Task<number, TypeError> = Task.fromPromise(
        new Promise<number>((resolve) => {
          const timerId = setTimeout(resolve, 128, 99);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(timerId);
          });
        }),
        (e) => e instanceof TypeError ? e : TypeError("Unknown", { cause: e }),
      );

      assertStrictEquals(controller.signal.aborted, false);

      const task = Tasks.all([fast, slow], { controller });
      const err = await task;

      assertStrictEquals(err.isErr(), true);
      assertStrictEquals(controller.signal.aborted, true);
    },
  );

  await t.step(
    ".all() -> does not abort when all tasks succeed",
    async () => {
      const controller = new AbortController();

      const task = Tasks.all(
        [Task.succeed(1), Task.succeed(2), Task.succeed(3)],
        { controller },
      );
      const ok = await task;

      assertStrictEquals(ok.isOk(), true);
      assertEquals(ok.unwrap(), [1, 2, 3]);
      assertStrictEquals(controller.signal.aborted, false);
    },
  );

  await t.step(".any() -> collects all Err values into an array", async () => {
    const collection: Task<string, number>[] = Array(5).fill(0).map((v, i) =>
      Task.fail(v + i)
    );

    const failure = Tasks.any(collection);
    const err = await failure;

    assertType<IsExact<typeof failure, Task<string, number[]>>>(true);
    assertStrictEquals(err.isErr(), true);
    assertEquals(err.unwrap(), [0, 1, 2, 3, 4]);
  });

  await t.step(
    ".any() -> returns the first instance of Ok if present in iterable",
    async () => {
      const success = Ok(42);
      const collection: Task<number, TypeError>[] = Array(5).fill(0).map(
        (_, i) => {
          if (i === 3) return Task.of(success);
          return Task.fail(TypeError());
        },
      );

      const task = Tasks.any(collection);
      const ok = await task;

      assertType<IsExact<typeof task, Task<number, TypeError[]>>>(true);
      assertStrictEquals(ok.isOk(), true);
      assertStrictEquals(ok, success);
    },
  );

  await t.step(
    ".any() -> returns the correct type when used on tuples",
    async () => {
      const str = Task.succeed("str") as Task<string, TypeError>;
      const num = Task.succeed(123) as Task<number, RangeError>;
      const bool = Task.succeed(true) as Task<boolean, Error>;
      const tuple = [str, num, bool] as const;

      const task = Tasks.any(tuple);
      const ok = await task;

      assertType<
        IsExact<
          typeof task,
          Task<
            string | number | boolean,
            readonly [TypeError, RangeError, Error]
          >
        >
      >(true);
      assertStrictEquals(ok.isOk(), true);
      assertEquals(ok.unwrap(), "str");
    },
  );

  await t.step(
    ".race() -> returns the first resolving Task instance",
    async () => {
      const first = Ok(42);
      const other = Ok(21);
      const timerIds: number[] = [];
      const collection: ArrayLike<Task<number, never>> = Array(5).fill(0)
        .map(
          (_, i) => {
            if (i === 3) return Task.of(first);
            const p = new Promise<Ok<number>>(
              (resolve) => {
                timerIds.push(setTimeout(resolve, 128, other));
              },
            );
            return Task.of(p);
          },
        );

      const task = Tasks.race(collection);
      const ok = await task;

      timerIds.forEach(clearTimeout);

      assertType<IsExact<typeof task, Task<number, never>>>(true);
      assertStrictEquals(ok.unwrap(), 42);
      assertStrictEquals(ok, first);
    },
  );

  await t.step(
    ".race() -> also returns first instance in case of Err",
    async () => {
      const first = Err(TypeError("This is the one"));
      const other = Ok(21);
      const timerIds: number[] = [];
      const collection: Task<number, TypeError>[] = Array(5).fill(0)
        .map(
          (_, i) => {
            if (i === 3) return Task.of(first);
            const p = new Promise<Ok<number>>(
              (resolve) => {
                timerIds.push(setTimeout(resolve, 128, other));
              },
            );
            return Task.of(p) as Task<number, TypeError>;
          },
        );

      const task = Tasks.race(collection);
      const err = await task;

      timerIds.forEach(clearTimeout);

      assertType<IsExact<typeof task, Task<number, TypeError>>>(true);
      assertStrictEquals(err.isErr(), true);
      assertStrictEquals(err, first);
    },
  );

  await t.step(
    ".race() -> returns the correct type when used on tuples",
    async () => {
      const str = Task.succeed("str") as Task<string, TypeError>;
      const num = Task.succeed(123) as Task<number, RangeError>;
      const bool = Task.succeed(true) as Task<boolean, Error>;
      const tuple = [str, num, bool] as const;

      const task = Tasks.race(tuple);
      const ok = await task;

      assertType<
        IsExact<
          typeof task,
          Task<
            string | number | boolean,
            TypeError | RangeError | Error
          >
        >
      >(true);
      assertStrictEquals(ok.isOk(), true);
    },
  );

  await t.step(
    ".race() -> calls abort on the provided AbortController after settlement",
    async () => {
      const controller = new AbortController();
      const timerIds: number[] = [];
      const winner = Ok(42);
      const other = Ok(21);
      const collection: Task<number, never>[] = Array(3).fill(0)
        .map(
          (_, i) => {
            if (i === 0) return Task.of(winner);
            const p = new Promise<Ok<number>>(
              (resolve) => {
                timerIds.push(setTimeout(resolve, 128, other));
              },
            );
            return Task.of(p);
          },
        );

      assertStrictEquals(controller.signal.aborted, false);

      const task = Tasks.race(collection, { controller });
      const ok = await task;

      timerIds.forEach(clearTimeout);

      assertStrictEquals(ok, winner);
      assertStrictEquals(controller.signal.aborted, true);
    },
  );

  await t.step(
    ".race() -> signals abort to in-flight Tasks",
    async () => {
      const controller = new AbortController();
      const { signal } = controller;
      let cleanupCalled = false;

      const fast = Task.succeed(42) as Task<number, Error>;
      const slow: Task<number, Error> = Task.fromFallible(
        () =>
          new Promise<number>((resolve, reject) => {
            const timerId = setTimeout(resolve, 128, 99);
            signal.addEventListener("abort", () => {
              clearTimeout(timerId);
              cleanupCalled = true;
              reject(signal.reason);
            });
          }),
        (e) => e instanceof Error ? e : Error("Unknown", { cause: e }),
      );

      const task = Tasks.race([fast, slow], { controller });
      const ok = await task;

      assertStrictEquals(ok.isOk(), true);
      assertStrictEquals(ok.unwrap(), 42);
      assertStrictEquals(cleanupCalled, true);
    },
  );
});
