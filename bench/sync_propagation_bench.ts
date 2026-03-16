//deno-lint-ignore-file
import { Err } from "../lib/core/result.ts";

const sink: unknown[] = [null];

Deno.bench({
  name: "Sync Exception Propagation",
  group: "Sync::Propagation",
  fn: () => {
    try {
      sink[0] = Exceptions.rethrow();
    } catch (e) {
      sink[0] = e;
    }
  },
});

Deno.bench({
  name: "Result Error Propagation",
  group: "Sync::Propagation",
  baseline: true,
  fn: () => {
    sink[0] = Errors.linearReturn();
  },
});

export namespace Exceptions {
  function fail() {
    throw TypeError("Fail!");
  }
  function propagate() {
    try {
      return fail();
    } catch (e) {
      throw e;
    }
  }
  export function rethrow() {
    try {
      return propagate();
    } catch (e) {
      throw e;
    }
  }
}

export namespace Errors {
  function fail() {
    return Err(TypeError("Fail!"));
  }
  function propagate() {
    return fail();
  }
  export function linearReturn() {
    return propagate();
  }
}
