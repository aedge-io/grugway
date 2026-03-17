# grugway

[![codecov](https://codecov.io/github/aedge-io/grugway/graph/badge.svg?token=9WTDQ8WOKW)](https://codecov.io/github/aedge-io/grugway)
![NPM Version](https://img.shields.io/npm/v/%40aedge-io%2Fgrugway)
![JSR Version](https://img.shields.io/jsr/v/%40aedge-io/grugway)

> Safe abstractions for fallible flows — for humans, their clankers and foes.

---

## Why grugway?

- **Explicit error handling** makes code behavior predictable for both humans
  and agents
- **Composable abstractions** allow agents to reason about data flow without
  hidden exceptions
- **Type-safe operations** catch mistakes at compile time rather than runtime
- **Callibrated documentation** provides context that agents can leverage for
  better performance (see [`SKILL.md`](SKILL.md))

---

## Core Abstractions

| Abstraction    | Purpose                               | Equivalent              |
| -------------- | ------------------------------------- | ----------------------- |
| `Option<T>`    | Handle presence/absence of values     | `T \| undefined`        |
| `Result<T, E>` | Handle success/failure explicitly     | `T \| E`                |
| `Task<T, E>`   | Async operations with explicit errors | `Promise<Result<T, E>>` |

---

## Quick Start

### Installation

**Node.js / Bun:**

```bash
(bun | (p)npm) add @aedge-io/grugway
```

**Deno**:

```bash
deno add jsr:@aedge-io/grugway
```

### Usage

```typescript
import { Err, None, Ok, Option, Result, Some, Task } from "@aedge-io/grugway";
```

### Runtime Requirements

- **Bun:** ≥1.0.0
- **Deno:** ≥1.14
- **Node.js:** ≥17.0.0
- **Browsers:** Support for `Error.cause` and `structuredClone`

---

## Examples

### Option — Handling Optional Values

```typescript
import { None, Option, Some } from "@aedge-io/grugway";
import { getUserById, id } from "grugway/examples";
import type { User } from "grugway/examples";

// Nullish values become None
const maybeUser = Option(getUserById(id)); // Option<User>

// Chain operations safely
const email = maybeUser
  .filter((user: User) => user.isActive)
  .map((user: User) => user.email)
  .unwrapOr("no-email@example.com");

// Convert to Result for error handling
const userResult = maybeUser.okOrElse(() => new Error("User not found"));
```

### Result — Explicit Error Handling

```typescript
import { Err, Ok, Result } from "@aedge-io/grugway";

function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return Err(new Error("Division by zero"));
  return Ok(a / b);
}

// Compose operations
const result = divide(10, 2)
  .map((n) => n * 2) // Only runs on Ok
  .andThen((n) => divide(n, 3)) // Chain fallible operations
  .mapErr((e) => new TypeError(e.message)); // Transform errors

// Unwrap with type narrowing
if (result.isOk()) {
  console.log(result.unwrap()); // this is inferred as number
}
```

### Task — Async Operations

```typescript
import { Err, Ok, Task } from "@aedge-io/grugway";
import { validateName } from "grugway/examples";

// Create tasks from promises
const fetchUser = Task.fromPromise(
  fetch("/api/user").then((r) => r.json()),
  (e: unknown) => new Error("Failed to fetch user", { cause: e }),
);

// Compose async operations with the same API as Result
const userName = fetchUser
  .map((user: { name: string }) => user.name)
  .andThen(validateName)
  .mapErr((e) => ({ code: "USER_ERROR", message: e.message }));

// Tasks are awaitable
const result = await userName;
result.inspect(console.log).inspectErr(console.error);
```

### Lifting External Code

Integrate third-party libraries without manual wrapping:

```typescript
import { Option, Result, Task } from "@aedge-io/grugway";
import * as semver from "@std/semver";

// Lift sync functions
const tryParse = Result.liftFallible(
  semver.parse,
  (e: unknown) => new TypeError("Invalid version", { cause: e }),
);

// Lift async functions
const tryFetch = Task.liftFallible(
  (url: string) => fetch(url).then((r) => r.json()),
  (e: unknown) => new Error("Fetch failed", { cause: e }),
);

// Use in pipelines
const version = Option(Deno.args[0])
  .okOr(new Error("No version provided"))
  .andThen(tryParse);
```

Checkout the [examples](examples/adapters/web/) to see how to do this more
granuarly.

---

## API Reference: Constructors & Helpers

Each abstraction provides multiple constructors and composability helpers for
different scenarios.

### Option<T>

#### Constructors

| Constructor                   | Returns       | Use When                                   |
| ----------------------------- | ------------- | ------------------------------------------ |
| `Option(value)`               | `Option<T>`   | General use — `null`/`undefined` → `None`  |
| `Option.from(value)`          | `Option<T>`   | Alias for `Option()`                       |
| `Option.fromCoercible(value)` | `Option<T>`   | Falsy values (`0`, `""`, `false`) → `None` |
| `Option.fromFallible(value)`  | `Option<T>`   | `Error` instances → `None`                 |
| `Some(value)`                 | `Some<T>`     | Explicitly wrap a non-nullish value        |
| `None`                        | `None`        | The absent value singleton                 |
| `Some.empty()`                | `Some<Empty>` | Signal success without a meaningful value  |

```typescript
import { Option } from "@aedge-io/grugway";

// Choose based on what should be "absent"
Option(0); // Some(0) — zero is a valid number
Option.fromCoercible(0); // None   — zero is "empty" in this context

Option(new Error()); // Some(Error) — errors are values too
Option.fromFallible(new Error()); // None    — errors mean absence
```

#### Composability Helpers

| Helper                           | Purpose                                                          |
| -------------------------------- | ---------------------------------------------------------------- |
| `Option.lift(fn, ctor?)`         | Wrap a function to return `Option` (default ctor: `Option.from`) |
| `Option.liftFallible(fn, ctor?)` | Same as `lift`, but exceptions → `None`                          |
| `Option.apply(fn, arg)`          | Apply `Option<Fn>` to `Option<Arg>` (applicative)                |
| `Option.id(opt)`                 | Identity — useful for flattening `Option<Option<T>>`             |

```typescript
import { Option } from "@aedge-io/grugway";

// Lift a parser that might return undefined
const parseIntSafe = Option.lift(parseInt, Option.fromCoercible);
parseIntSafe("42"); // Some(42)
parseIntSafe("abc"); // None (NaN is falsy)

// Lift a function that throws
const parseJSON = Option.liftFallible(JSON.parse);
parseJSON('{"a":1}'); // Some({a: 1})
parseJSON("invalid"); // None
```

#### Collection Helpers (`Options` namespace)

| Helper                  | Returns       | Behavior                                      |
| ----------------------- | ------------- | --------------------------------------------- |
| `Options.all(opts)`     | `Option<T[]>` | All `Some` → `Some<T[]>`, any `None` → `None` |
| `Options.any(opts)`     | `Option<T>`   | First `Some` found, or `None`                 |
| `Options.areSome(opts)` | `boolean`     | Type predicate: all are `Some`                |
| `Options.areNone(opts)` | `boolean`     | Type predicate: all are `None`                |

---

### Result<T, E>

#### Constructors

| Constructor                         | Returns            | Use When                                              |
| ----------------------------------- | ------------------ | ----------------------------------------------------- |
| `Ok(value)`                         | `Ok<T>`            | Explicit success                                      |
| `Err(error)`                        | `Err<E>`           | Explicit failure                                      |
| `Result(value)`                     | `Result<T, E>`     | Auto-detect — `Error` instances → `Err`               |
| `Result.from(fn)`                   | `Result<T, never>` | Get value of infallible function (throws → propagate) |
| `Result.fromFallible(fn, errMapFn)` | `Result<T, E>`     | Get value of fallible function (throws → `Err`)       |
| `Ok.empty()`                        | `Ok<Empty>`        | Signal success without a value                        |
| `Err.empty()`                       | `Err<Empty>`       | Signal failure without details                        |

```typescript
import { Result } from "@aedge-io/grugway";
import { getString, MathError, riskyDivision } from "grugway/examples";

// Auto-detection for union types
const value: string | TypeError = getString();
Result(value); // Ok<string> or Err<TypeError> based on runtime type

// Get the result of a fallible function
const safeDivide = Result.fromFallible(
  riskyDivision,
  (e: unknown) => new MathError("Division failed", { cause: e }),
);
```

#### Composability Helpers

| Helper                                     | Purpose                                                             |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `Result.lift(fn, ctor?)`                   | Wrap function to return `Result` (panics propagate)                 |
| `Result.liftFallible(fn, errMapFn, ctor?)` | Wrap function, map exceptions to `Err<E>`                           |
| `asInfallible`                             | Error mapper that re-throws — marks function as "should never fail" |

```typescript
import { asInfallible, Ok, Result } from "@aedge-io/grugway";
// Integrate a library function that throws
import * as semver from "@std/semver";

const tryParse = Result.liftFallible(
  semver.parse,
  (e: unknown) => new TypeError("Invalid semver", { cause: e }),
);

Ok("1.2.3").andThen(tryParse); // Ok<SemVer>
Ok("bad").andThen(tryParse); // Err<TypeError>

// Mark a function as infallible (will throw Panic if it actually fails)
const alwaysParses = Result.liftFallible(
  (input: string) => JSON.parse(input),
  asInfallible, // "I promise this won't throw"
);
```

#### Collection Helpers (`Results` namespace)

| Helper                 | Returns          | Behavior                                         |
| ---------------------- | ---------------- | ------------------------------------------------ |
| `Results.all(results)` | `Result<T[], E>` | All `Ok` → `Ok<T[]>`, first `Err` short-circuits |
| `Results.any(results)` | `Result<T, E[]>` | First `Ok` found, or all `Err`s collected        |

```typescript
import { Results } from "@aedge-io/grugway";
import {
  input,
  loadDefaults,
  loadFromEnv,
  loadFromFile,
  validateAge,
  validateEmail,
  validateName,
} from "grugway/examples";

// Validate multiple fields, fail on first error. Supports tuples!
const validated = Results.all(
  [
    validateName(input.name),
    validateEmail(input.email),
    validateAge(input.age),
  ] as const,
);
// Result<[string, string, number], ValidationError>

// Try multiple strategies, succeed on first
const config = Results.any([
  loadFromEnv(),
  loadFromFile(),
  loadDefaults(),
]);
// Result<Config, EnvError|FileError|DefaultError[]>
```

---

### Task<T, E>

#### Constructors

| Constructor                           | Returns              | Use When                                              |
| ------------------------------------- | -------------------- | ----------------------------------------------------- |
| `Task.succeed(value)`                 | `Task<T, never>`     | Immediate success                                     |
| `Task.fail(error)`                    | `Task<never, E>`     | Immediate failure                                     |
| `Task.of(result)`                     | `Task<T, E>`         | From `Result<T,E>` or `Promise<Result<T,E>>`          |
| `Task.from(fn)`                       | `Task<T, E>`         | From function returning `Result` or `Promise<Result>` |
| `Task.fromPromise(promise, errMapFn)` | `Task<T, E>`         | From `Promise<T>`, map rejections to `Err`            |
| `Task.fromFallible(fn, errMapFn)`     | `Task<T, E>`         | From async function that might throw                  |
| `Task.deferred()`                     | `DeferredTask<T, E>` | For push-based APIs (callbacks, events)               |

```typescript
import { Task } from "@aedge-io/grugway";
import { Data, FetchError, legacyApi, TimeoutError } from "grugway/examples";

// Wrap fetch with proper error handling
const fetchJson = <T>(url: string): Task<T, FetchError> =>
  Task.fromPromise(
    fetch(url).then((r) => r.json()),
    (e: unknown) => new FetchError(url, { cause: e }),
  );

// Deferred task for callback or push based APIs
const { task, succeed, fail } = Task.deferred<Data, TimeoutError>();
const timer = setTimeout(() => fail(new TimeoutError()), 5000);
legacyApi.fetch((err, data) => err ? fail(err) : succeed(data!));
await task; // Resolves when either callback fires
clearTimeout(timer);
```

#### Composability Helpers

| Helper                                   | Purpose                                         |
| ---------------------------------------- | ----------------------------------------------- |
| `Task.liftFallible(fn, errMapFn, ctor?)` | Wrap async function, map exceptions to `Err<E>` |

```typescript
import { Task } from "@aedge-io/grugway";
import { ApiError } from "grugway/examples";

// Lift an async library function
// Check out the ready-made fetch adapter example for a more thorough take on this
const tryFetch = Task.liftFallible(
  async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  (e: unknown) => new ApiError("Request failed", { cause: e }),
);

// Use in pipelines
Task.succeed("/api/users")
  .andThen(tryFetch)
  .map((users: { active: boolean }[]) => users.filter((u) => u.active))
  .inspectErr(console.error);
```

#### Collection Helpers (`Tasks` namespace)

| Helper             | Returns        | Behavior                                              |
| ------------------ | -------------- | ----------------------------------------------------- |
| `Tasks.all(tasks)` | `Task<T[], E>` | All succeed → `Ok<T[]>`, first failure short-circuits |
| `Tasks.any(tasks)` | `Task<T, E[]>` | First success, or all failures collected              |

```typescript
import { Tasks } from "@aedge-io/grugway";
import {
  fetchFromCache,
  fetchFromPrimary,
  fetchFromReplica,
  fetchOrders,
  fetchProducts,
  fetchUsers,
} from "grugway/examples";

// These work for all iterables
// Parallel fetch with combined results
const allData = await Tasks.all(
  [
    fetchUsers(),
    fetchProducts(),
    fetchOrders(),
  ] as const,
);
// Result<[User[], Product[], Order[]], ApiError>

// Race multiple sources
const fastestResponse = await Tasks.any(
  [
    fetchFromPrimary(),
    fetchFromReplica(),
    fetchFromCache(),
  ] as const,
);
// Result<Data, [PrimaryError, ReplicaError, CacheError]>
```

---

## Key Patterns

### Railway-Oriented Programming

Build pipelines where success flows forward and errors short-circuit:

```typescript
import { Task } from "@aedge-io/grugway";
import {
  generateReceipt,
  getOrder,
  logError,
  processPayment,
  validateOrder,
} from "grugway/examples";
import type { OrderError, Receipt } from "grugway/examples";

function processOrder(orderId: string): Task<Receipt, OrderError> {
  return getOrder(orderId) // Task<Order, NotFoundError>
    .andThen(validateOrder) // Task<Order, ValidationError>
    .andThen(processPayment) // Task<Payment, PaymentError>
    .andThen(generateReceipt) // Task<Receipt, ReceiptError>
    .inspectErr(logError);
}
```

### Pass-through Conditionals

Validate without consuming the value:

```typescript
import { Result } from "@aedge-io/grugway";
import { isValid, isWritable, parse, writeFile } from "grugway/examples";

function saveFile(path: string): Result<void, Error> {
  return parse(path)
    .andEnsure(isValid) // Validate, but keep original path
    .andEnsure(isWritable) // Check permissions, keep path
    .andThen(writeFile);
}
```

---

## Best Practices

1. **Computations, not data** — Use these abstractions for operation results,not
   data models
2. **Embrace immutability** — Don't mutate wrapped values
3. **Unwrap at the edges** — Keep Result/Task types in your domain logic; unwrap
   at API boundaries
4. **Some errors are fatal** — It's okay to throw for truly unrecoverable
   states. Just make sure to catch at the top level and terminate gracefully.
5. **Lift external code** — Use `liftFallible` to integrate libraries cleanly

---

## Performance

These abstractions are _not totally performance prohibitive_. In benchmarks, the
linear return path often performs slightly better than nested try/catch blocks:

```
Synchronous:  Result flow ~1.3x faster than exceptions
Asynchronous: Task flow   ~1.0x (equivalent performance)
```

**Your mileage will vary though.** Memory isn't free. Run benchmarks yourself:
`deno bench`

### License

This is a ~~fork~~ rework of an old, personal project
[eitherway](https://github.com/realpha/eitherway).

MIT License — see [LICENSE.md](./LICENSE.md)

- Original eitherway: Copyright © 2023-2025 realpha
- grugway modifications: Copyright © 2026 aedge-io

---

## Resources

- [Original eitherway documentation](https://deno.land/x/eitherway)
- ["Railway-oriented programming" — Scott Wlaschin](https://vimeo.com/113707214)
- ["Boundaries" — Gary Bernhardt](https://www.destroyallsoftware.com/talks/boundaries)
- ["Errors are values" — Rob Pike](https://go.dev/blog/errors-are-values)
