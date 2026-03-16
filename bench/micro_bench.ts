//deno-lint-ignore-file
import { asInfallible, Err, Ok, Result } from "../lib/core/result.ts";
import { Task } from "../lib/async/task.ts";
import { Option } from "../lib/core/option.ts";

const str = "foo";
const ERR = Err(str);
const OK = Ok(str);

/* some benchmarks were TOO GOOD because of DCE. this should prevent it */
const sink: unknown[] = [null];

async function produceRes(): Promise<Result<string, never>> {
  return Ok(str);
}

async function produceValue(): Promise<string> {
  return str;
}

Deno.bench({
  name: "Promise.resolve(Ok)",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = Promise.resolve(OK);
  },
});

Deno.bench({
  name: "new Promise(Ok)",
  group: "Micro::Async::Construction",
  baseline: true,
  fn: () => {
    sink[0] = new Promise((resolve) => resolve(OK));
  },
});

Deno.bench({
  name: "Task.succeed",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = Task.succeed(str);
  },
});

Deno.bench({
  name: "Task.of(Ok)",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = Task.of(OK);
  },
});

Deno.bench({
  name: "Promise.resolve(Err)",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = Promise.resolve(ERR);
  },
});

Deno.bench({
  name: "new Promise(Err)",
  group: "Micro::Async::Construction",
  baseline: true,
  fn: () => {
    sink[0] = new Promise((resolve) => resolve(ERR));
  },
});

Deno.bench({
  name: "Task.fail",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = Task.fail(str);
  },
});

Deno.bench({
  name: "Task.of(Err)",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = Task.of(ERR);
  },
});

Deno.bench({
  name: "Task.of(Promise<Result>)",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = Task.of(produceRes());
  },
});

Deno.bench({
  name: "Task.fromFallible(() => Promise<string>)",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = Task.fromFallible(produceValue, asInfallible);
  },
});

Deno.bench({
  name: "AsyncFn(() => Promise<Result<string, never>>)",
  group: "Micro::Async::Construction",
  fn: () => {
    sink[0] = produceRes();
  },
});

Deno.bench({
  name: "Ok",
  group: "Micro::Construction",
  fn: () => {
    sink[0] = Ok(str);
  },
});

Deno.bench({
  name: "Err",
  group: "Micro::Construction",
  fn: () => {
    sink[0] = Err(str);
  },
});

Deno.bench({
  name: "Option",
  group: "Micro::Construction",
  fn: () => {
    sink[0] = Option(str);
  },
});
