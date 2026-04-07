---
name: grugway
description: Use the grugway library for type-safe error handling in TypeScript/JavaScript projects. Provides Option<T>, Result<T,E>, and Task<T,E> abstractions for composable, exception-free control flow.
---

# grugway

TypeScript library for safe, composable error handling.

**Import:**

```typescript
import {
  asInfallible,
  Err, // Result types
  None, // Option types
  Ok,
  Option,
  Options,
  Panic, // Error utilities
  panic,
  Result,
  Results,
  Some,
  Task, // Async Result
  Tasks, // Collection helpers
  unsafeCastTo, // Unsafe cast (prototyping only)
} from "@aedge-io/grugway";
```

**Subpath export — typed deep clone:**

```typescript
import { clone } from "@aedge-io/grugway/clone";
```

## Rules

1. **Never pass nullish to `Some()`** — it panics. Use `Option(value)` instead.
2. **Never throw inside functions returning `Result` or `Task`** — return
   `Err()` instead.
3. **Unwrap at the edges** — keep `Option`/`Result`/`Task` types in domain
   logic, unwrap at API boundaries.
4. **All map/chain ops are closed** — they always return the same abstraction
   type.
5. **Don't over do it** — strike a sensible balance between functional chaining
   and an imperative style.
6. **Never use `.trip()` or `.rise()`** — they are deprecated. Use
   `.andEnsure()` and `.orEnsure()` instead.

---

## Option\<T\> — represents `T | undefined`

### Constructors

| Constructor                   | Behavior                                     |
| ----------------------------- | -------------------------------------------- |
| `Option(value)`               | `null`/`undefined` → `None`, else `Some<T>`  |
| `Option.from(value)`          | Same as `Option()`                           |
| `Option.fromCoercible(value)` | Falsy (`0`, `""`, `false`, `NaN`) → `None`   |
| `Option.fromFallible(value)`  | `Error` instances → `None`                   |
| `Some(value)`                 | Wraps non-nullish value (panics on nullish!) |
| `Some.empty()`                | `Some<Empty>` — signal success without value |
| `None`                        | Singleton absent value                       |

### Methods on Option\<T\>

**Type check:**

- `.isSome(): boolean` — narrows to `Some<T>`
- `.isNone(): boolean` — narrows to `None`

**Transform (only runs on Some):**

- `.map(fn)` — `T → U`, returns `Option<U>`
- `.andThen(fn)` — `T → Option<U>`, returns `Option<U>` (flatMap)
- `.filter(pred)` — keeps `Some` if predicate passes, else `None`. Supports type
  narrowing via type predicates.
- `.andEnsure(fn)` — `T → Option<U>`: if `Some`, keep original; if `None`,
  become `None`

**Transform (only runs on None):**

- `.orElse(fn)` — `() → Option<U>`, returns `Option<U>`

**Fallback:**

- `.mapOr(fn, fallback)` — map or use fallback value
- `.mapOrElse(fn, elseFn)` — map or call fallback fn

**Logical:**

- `.and(other)` — returns `other` if both `Some`, else `None`
- `.or(other)` — returns first `Some`
- `.xor(other)` — returns `Some` if exactly one is `Some`
- `.zip(other)` — both `Some` → `Some<[T, U]>`, else `None`

**Unwrap:**

- `.unwrap()` — returns `T | undefined` (no throw!)
- `.unwrapOr(fallback)` — returns `T` or fallback value
- `.unwrapOrElse(fn)` — returns `T` or calls fn

**Convert to Result:**

- `.okOr(err)` — `Some→Ok`, `None→Err(err)`
- `.okOrElse(fn)` — `Some→Ok`, `None→Err(fn())`

**Identity & cloning:**

- `.id()` — returns self; useful for flattening `Option<Option<T>>` via
  `.andThen(o => o.id())`
- `.clone()` — deep clone via `typed-clone`

**Side effects:**

- `.inspect(fn)` — calls fn with value on `Some`, no-op on `None`
- `.tap(fn)` — calls fn with the `Option` instance, returns self
- `.into(fn)` — passes `Option` to fn, returns fn's result

**JS interop:** `String(some)` delegates to inner value, `JSON.stringify(some)`
calls inner `.toJSON()`, spread `[...some]` delegates to inner iterator.
`.iter()` yields the inner value once (or nothing for `None`).

### Collection Helpers

- `Options.all(opts)` → all `Some` → `Some<T[]>`, any `None` → `None`
- `Options.any(opts)` → first `Some`, or `None`
- `Options.areSome(opts)` → type predicate: all are `Some`
- `Options.areNone(opts)` → type predicate: all are `None`

### Composability

- `Option.lift(fn, ctor?)` — wrap fn to return `Option` (default ctor:
  `Option.from`; use `Option.fromCoercible` to treat falsy as `None`)
- `Option.liftFallible(fn, ctor?)` — same as `lift`, but exceptions → `None`
- `Option.apply(fn, arg)` — apply `Option<Fn>` to `Option<Arg>` (applicative)
- `Option.id(opt)` — identity function, returns `opt.id()`

---

## Result\<T, E\> — represents `T | E`

### Constructors

| Constructor                         | Behavior                                       |
| ----------------------------------- | ---------------------------------------------- |
| `Ok(value)`                         | Explicit success                               |
| `Err(error)`                        | Explicit failure                               |
| `Ok.empty()`                        | `Ok<Empty>` — signal success without a value   |
| `Err.empty()`                       | `Err<Empty>` — signal failure without details  |
| `Result(value)`                     | `Error` instances → `Err`, else `Ok`           |
| `Result.from(fn)`                   | Call fn, return `Ok(result)` (throws → Panic!) |
| `Result.fromFallible(fn, errMapFn)` | Call fn, exceptions → `Err(errMapFn(e))`       |

### Methods on Result\<T, E\>

**Type check:**

- `.isOk(): boolean` — narrows to `Ok<T>`
- `.isErr(): boolean` — narrows to `Err<E>`

**Transform (only runs on Ok):**

- `.map(fn)` — `T → U`, returns `Result<U, E>`
- `.andThen(fn)` — `T → Result<U, E2>`, returns `Result<U, E|E2>` (flatMap)
- `.andEnsure(fn)` — `T → Result<any, E2>`: if `Ok`, keep original `Ok<T>`; if
  `Err`, return `Err<E2>`

**Transform (only runs on Err):**

- `.mapErr(fn)` — `E → E2`, returns `Result<T, E2>`
- `.orElse(fn)` — `E → Result<T2, E2>`, returns `Result<T|T2, E2>` (flatMap on
  Err)
- `.orEnsure(fn)` — `E → Result<T2, any>`: if `Ok`, return new `Ok<T2>`; if
  `Err`, keep original `Err<E>`

**Fallback:**

- `.mapOr(fn, fallback)` — map Ok or use fallback value
- `.mapOrElse(fn, elseFn)` — map Ok or call elseFn with Err

**Logical:**

- `.and(other)` — returns `other` if both `Ok`, else first `Err`
- `.or(other)` — returns first `Ok`
- `.zip(other)` — both `Ok` → `Ok<[T, U]>`, else `Err`

**Unwrap:**

- `.unwrap()` — returns `T | E` (no throw!)
- `.unwrapOr(fallback)` — returns `T` or fallback value
- `.unwrapOrElse(fn)` — returns `T` or calls `fn(err)`

**Convert:**

- `.ok()` — `Ok→Some<T>`, `Err→None`
- `.err()` — `Err→Some<E>`, `Ok→None`
- `.toTuple()` — `Ok→[T, never]`, `Err→[never, E]`
- `.asResult()` — safe type cast to `Result<T, E>` (from `Ok`/`Err`)
- `.id()` — identity, returns self (useful for flattening)
- `.into(fn)` — passes `Result` to fn, returns fn's result
- `.clone()` — deep clone via `typed-clone`
- `.iter()` — `Ok` → `IterableIterator<T>`, `Err` → empty iterator

**Side effects:**

- `.inspect(fn)` — calls fn with value on `Ok`
- `.inspectErr(fn)` — calls fn with error on `Err`
- `.tap(fn)` — calls fn with the `Result` instance, returns self

### Collection Helpers

- `Results.all(results)` → all `Ok` → `Ok<T[]>`, first `Err` short-circuits
- `Results.any(results)` → first `Ok`, or `Err<E[]>` with all errors

### Composability

- `Result.lift(fn, ctor?)` — wrap fn to return `Result` (panics propagate)
- `Result.liftFallible(fn, errMapFn, ctor?)` — wrap fn, exceptions →
  `Err(errMapFn(e))`
- `asInfallible` — error mapper that re-throws (marks fn as "should never fail")

---

## Task\<T, E\> — represents `Promise<Result<T, E>>`

Subclass of `Promise`. Same API as `Result` for chaining, but async. Sync and
async fns can be mixed freely in `.map()` / `.andThen()` / `.andEnsure()` etc.

### Constructors

| Constructor                           | Behavior                                              |
| ------------------------------------- | ----------------------------------------------------- |
| `Task.succeed(value)`                 | Immediate `Ok`                                        |
| `Task.fail(error)`                    | Immediate `Err`                                       |
| `Task.of(result)`                     | From `Result<T,E>` or `Promise<Result<T,E>>`          |
| `Task.from(fn)`                       | From `() → Result` or `() → Promise<Result>`          |
| `Task.fromPromise(promise, errMapFn)` | From `Promise<T>`, rejections → `Err`                 |
| `Task.fromFallible(fn, errMapFn)`     | From async fn that might throw                        |
| `Task.deferred()`                     | Returns `{ task, succeed, fail }` for push-based APIs |

### Key differences from Result

- `.isOk()` / `.isErr()` not available (must await first)
- `await task` returns `Result<T, E>`
- Can return `Task<T, E>` as `Promise<Result<T, E>>` from async functions
- `.andEnsure()`, `.orEnsure()`, `.zip()` all accept async fns

### Composability

- `Task.liftFallible(fn, errMapFn, ctor?)` — wrap async fn, exceptions → `Err`
- `Tasks.all(tasks, opts?)` → all succeed → `Ok<T[]>`, first failure
  short-circuits
- `Tasks.any(tasks, opts?)` → first success, or all failures collected
- `Tasks.race(tasks, opts?)` → first to settle wins (like `Promise.race` but
  returns `Task`)

All three accept optional `{ controller: AbortController }` for cancellation of
abandoned tasks.

---

## Error Utilities

- `panic(err)` — throws `err` if it's an `Error`, otherwise wraps in `Panic`.
  Use as `unwrapOrElse(panic)` to emulate throwing unwrap.
- `asInfallible` — error mapper that wraps in `Panic`. Use with
  `liftFallible`/`fromFallible` to assert a fn should never fail.
- `Panic<E>` — internal error class. `Panic.isPanic(err)` to detect.
- `unsafeCastTo<E>` — cast `unknown` to `E`. Unsafe, prototyping only.

---

## Common Patterns

**Railway oriented processing:**

```typescript
const result = getOrder(id) // Task<Order, NotFoundError>
  .andThen(validateOrder) // Task<Order, ValidationError>
  .andThen(processPayment) // Task<Payment, PaymentError>
  .inspect(logConfirmation)
  .inspectErr(logError);
```

**Option → Result → Task escalation:**

```typescript
Option(input) // Option<string>
  .okOrElse(() => new Error("missing")) // Result<string, Error>
  .into((res) => Task.of(res)) // Task<string, Error>
  .andThen(asyncProcess); // Task<Output, Error>
```

**Validate without consuming (pass-through):**

```typescript
Ok(path)
  .andEnsure(validatePath) // validate, keep original path on success
  .andEnsure(checkPermissions) // check, keep original path on success
  .andThen(writeFile); // use the path
```

**Integrate throwing library code:**

```typescript
const safeParse = Result.liftFallible(
  JSON.parse,
  (e) => new SyntaxError("Bad JSON", { cause: e }),
);
Ok(rawString).andThen(safeParse);
```

**Parse, don't validate #1:**

```typescript
const safeParse = Result.liftFallible(
  semver.parse,
  (e) => new TypeError("Bad version", { cause: e }),
);

const version = Option(Deno.args[0])
  .okOr(new Error("No version provided"))
  .andThen(safeParse);
```

**Parse, don't validate #2:**

```typescript
const value: unknown = untypedApi.get("value");

Option.fromCoercible(value) // all falsy values are `None`
  .filter((value): value is unknown[] => Array.isArray(value))
  .okOrElse(() => Error("Expected an array value"));
```

**Sensible balance:**

```typescript
async function main() {
  const parsedOpts = parseScriptArgs(Deno.args);

  if (parsedOpts.isErr()) return parsedOpts;

  const opts = parsedOpts.unwrap();

  if (opts.help) {
    console.log(usage); /* should go to stdout */
    return Ok(undefined);
  }

  if (!opts.plan && opts.release) {
    $.logWarn("specifying a release type only affects plan mode");
  }

  $.logStep(`executing in ${opts.dirty ? "dry" : "live"}-run mode`);

  return await Task.succeed(opts)
    .inspect(ifVerbose(`plan mode: ${opts.plan}`))
    .inspect(ifVerbose(`apply mode: ${opts.apply}`))
    .andThen(gatherCtx)
    .andThen(generatePlan)
    .andThen(apply);
}

await main().then(exit).catch(abort);
```
