//deno-lint-ignore-file
import { Option } from "../lib/core/option.ts";
import { Result } from "../lib/core/result.ts";

const INPUTS = [
  undefined,
  "fortytwo",
  "lenghtySuperLenghtyGibberishString",
  "",
  "5",
];

const sink: unknown[] = [null];

Deno.bench({
  name: "Sync Exceptions",
  group: "Sync::Composition",
  fn: () => {
    INPUTS.forEach((i) => {
      try {
        sink[0] = SyncExceptions.processString(i);
      } catch (e) {
        sink[0] = e;
      }
    });
  },
});

Deno.bench({
  name: "Result Instance Composition",
  group: "Sync::Composition",
  baseline: true,
  fn: () => {
    INPUTS.forEach((i) => sink[0] = SyncResults.instanceComposition(i));
  },
});

Deno.bench({
  name: "Result Early Return",
  group: "Sync::Composition",
  fn: () => {
    INPUTS.forEach((i) => sink[0] = SyncResults.earlyReturn(i));
  },
});

namespace SyncExceptions {
  function toUpperCase(input: string | undefined): string {
    if (typeof input === "undefined") {
      throw new TypeError("Input is undefined");
    }
    return input.toUpperCase();
  }

  function stringToLength(input: string): number {
    if (input.length === 0) {
      throw new TypeError("Input string is empty");
    }
    return input.length;
  }

  function powerOfSelf(input: number): number {
    if ([Infinity, -Infinity, NaN, undefined].includes(input)) {
      throw new TypeError("Input is not a valid number");
    }

    const res = Math.pow(input, input);

    if ([Infinity, -Infinity, NaN, undefined].includes(res)) {
      throw new TypeError("Cannot calculate result");
    }

    return res;
  }

  export function processString(input: string | undefined): number {
    try {
      const upperCased = toUpperCase(input);
      const length = stringToLength(upperCased);
      return powerOfSelf(length);
    } catch (error) {
      throw error;
    }
  }
}

namespace SyncResults {
  function toUpperCase(input: string | undefined): Result<string, TypeError> {
    return Option(input)
      .okOrElse(() => TypeError("Input is undefined"))
      .map((str) => str.toUpperCase());
  }

  function stringToLength(input: string): Result<number, TypeError> {
    return Option.fromCoercible(input)
      .okOrElse(() => TypeError("Input string is empty"))
      .map((str) => str.length);
  }

  function powerOfSelf(input: number): Result<number, TypeError> {
    return Option.fromCoercible(input)
      .okOrElse(() => TypeError("Input is not a valid number"))
      .andThen((n) => {
        return Option.fromCoercible(Math.pow(n, n))
          .okOrElse(() => TypeError("Cannot calculate result"));
      });
  }

  export function instanceComposition(
    input: string | undefined,
  ): Result<number, TypeError> {
    return toUpperCase(input)
      .andThen(stringToLength)
      .andThen(powerOfSelf);
  }

  export function earlyReturn(
    input: string | undefined,
  ): Result<number, TypeError> {
    const upperCased = toUpperCase(input);
    if (upperCased.isErr()) return upperCased;

    const length = stringToLength(upperCased.unwrap());
    if (length.isErr()) return length;

    return powerOfSelf(length.unwrap());
  }
}
