//deno-lint-ignore-file
import { asInfallible, Err, Ok, Result } from "../lib/core/result.ts";
import { Task } from "../lib/async/task.ts";
import { Task as Task2 } from "../lib/async/task_2.ts";
import { Option } from "../lib/core/option.ts";

const str = "foo";
const ERR = Err(str);
const OK = Ok(str);

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
    const res = Promise.resolve(OK);
  },
});

Deno.bench({
  name: "new Promise(Ok)",
  group: "Micro::Async::Construction",
  baseline: true,
  fn: () => {
    const res = new Promise((resolve) => resolve(OK));
  },
});

Deno.bench({
  name: "Task.succeed",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task.succeed(str);
  },
});

Deno.bench({
  name: "Task.of(Ok)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task.of(OK);
  },
});

Deno.bench({
  name: "Task2.succeed",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task2.succeed(str);
  },
});

Deno.bench({
  name: "Task2.of(Ok)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task2.of(OK);
  },
});

Deno.bench({
  name: "Promise.resolve(Err)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Promise.resolve(ERR);
  },
});

Deno.bench({
  name: "new Promise(Err)",
  group: "Micro::Async::Construction",
  baseline: true,
  fn: () => {
    const res = new Promise((resolve) => resolve(ERR));
  },
});

Deno.bench({
  name: "Task.fail",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task.fail(str);
  },
});

Deno.bench({
  name: "Task.of(Err)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task.of(ERR);
  },
});

Deno.bench({
  name: "Task.of(Promise<Result>)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task.of(produceRes());
  },
});

Deno.bench({
  name: "Task2.fail",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task2.fail(str);
  },
});

Deno.bench({
  name: "Task2.of(Err)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task2.of(ERR);
  },
});

Deno.bench({
  name: "Task2.of(Promise<Result>)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task2.of(produceRes());
  },
});

Deno.bench({
  name: "Task.fromFallible(() => Promise<string>)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = Task.fromFallible(produceValue, asInfallible);
  },
});

Deno.bench({
  name: "AsyncFn(() => Promise<Result<string, never>>)",
  group: "Micro::Async::Construction",
  fn: () => {
    const res = produceRes();
  },
});

Deno.bench({
  name: "Ok",
  group: "Micro::Construction",
  fn: () => {
    const res = Ok(str);
  },
});

Deno.bench({
  name: "Err",
  group: "Micro::Construction",
  fn: () => {
    const res = Err(str);
  },
});

Deno.bench({
  name: "Option",
  group: "Micro::Construction",
  fn: () => {
    const res = Option(str);
  },
});
