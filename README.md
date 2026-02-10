# aetherway

> Safe abstractions for fallible flows — for humans and clankers alike.

This is a fork of the now stale project [eitherway](https://github.com/realpha/eitherway).

**MANDATORY AI DISCLAIMER:** LLMs are/were used for parts of the refactoring and documentation.

---

## Why aetherway?

This is for now mostly an experiment in human - agent collaboration and in-context learning. The basic assumptions are:

- **Explicit error handling** makes code behavior predictable for both humans and agents
- **Composable abstractions** allow agents to reason about data flow without hidden exceptions
- **Type-safe operations** catch mistakes at compile time rather than runtime
- **Callibrated documentation** provides context that agents can leverage for better performance

---

## Core Abstractions

| Abstraction | Purpose | Equivalent |
|-------------|---------|------------|
| `Option<T>` | Handle presence/absence of values | `T \| undefined` |
| `Result<T, E>` | Handle success/failure explicitly | `T \| E` |
| `Task<T, E>` | Async operations with explicit errors | `Promise<Result<T, E>>` |

---

## Quick Start

### Installation

-- WORK IN PROGRESS --

**Deno:**
```typescript
import { Option, Result, Task, Ok, Err, Some, None } from "https://deno.land/x/aetherway/mod.ts";
```

**Node.js:**
```bash
npm add aetherway
```

```typescript
import { Option, Result, Task, Ok, Err, Some, None } from "aetherway";
```

### Runtime Requirements

- Bun: tbd
- **Deno:** ≥1.14
- **Node.js:** ≥17.0.0
- **Browsers:** Support for `Error.cause` and `structuredClone`

---

## Examples

### Option — Handling Optional Values

```typescript
import { Option, Some, None } from "aetherway";

// Nullish values become None
const maybeUser = Option(getUserById(id)); // Option<User>

// Chain operations safely
const email = maybeUser
  .filter(user => user.isActive)
  .map(user => user.email)
  .unwrapOr("no-email@example.com");

// Convert to Result for error handling
const userResult = maybeUser.okOrElse(() => new Error("User not found"));
```

### Result — Explicit Error Handling

```typescript
import { Ok, Err, Result } from "aetherway";

function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return Err(new Error("Division by zero"));
  return Ok(a / b);
}

// Compose operations
const result = divide(10, 2)
  .map(n => n * 2)           // Only runs on Ok
  .andThen(n => divide(n, 3)) // Chain fallible operations
  .mapErr(e => new TypeError(e.message)); // Transform errors

// Unwrap with type narrowing
if (result.isOk()) {
  console.log(result.unwrap()); // this is inferred as number
}
```

### Task — Async Operations

```typescript
import { Task, Ok, Err } from "aetherway";

// Create tasks from promises
const fetchUser = Task.fromPromise(
  fetch("/api/user").then(r => r.json()),
  (e) => new Error("Failed to fetch user", { cause: e })
);

// Compose async operations with the same API as Result
const userName = fetchUser
  .map(user => user.name)
  .andThen(validateName)
  .mapErr(e => ({ code: "USER_ERROR", message: e.message }));

// Tasks are awaitable
const result = await userName;
result.inspect(console.log).inspectErr(console.error);
```

### Lifting External Code

Integrate third-party libraries without manual wrapping:

```typescript
import { Result, Task } from "aetherway";
import * as semver from "semver";

// Lift sync functions
const tryParse = Result.liftFallible(
  semver.parse,
  (e) => new TypeError("Invalid version", { cause: e })
);

// Lift async functions
const tryFetch = Task.liftFallible(
  (url: string) => fetch(url).then(r => r.json()),
  (e) => new Error("Fetch failed", { cause: e })
);

// Use in pipelines
const version = Option(Deno.args[0])
  .okOr(new Error("No version provided"))
  .andThen(tryParse);
```

---

## API Reference: Constructors & Helpers

Each abstraction provides multiple constructors and composability helpers for different scenarios.

### Option<T>

#### Constructors

| Constructor | Returns | Use When |
|-------------|---------|----------|
| `Option(value)` | `Option<T>` | General use — `null`/`undefined` → `None` |
| `Option.from(value)` | `Option<T>` | Alias for `Option()` |
| `Option.fromCoercible(value)` | `Option<T>` | Falsy values (`0`, `""`, `false`) → `None` |
| `Option.fromFallible(value)` | `Option<T>` | `Error` instances → `None` |
| `Some(value)` | `Some<T>` | Explicitly wrap a non-nullish value |
| `None` | `None` | The absent value singleton |
| `Some.empty()` | `Some<Empty>` | Signal success without a meaningful value |

```typescript
// Choose based on what should be "absent"
Option(0);              // Some(0) — zero is a valid number
Option.fromCoercible(0); // None   — zero is "empty" in this context

Option(new Error());           // Some(Error) — errors are values too
Option.fromFallible(new Error()); // None    — errors mean absence
```

#### Composability Helpers

| Helper | Purpose |
|--------|---------|
| `Option.lift(fn, ctor?)` | Wrap a function to return `Option` (default ctor: `Option.from`) |
| `Option.liftFallible(fn, ctor?)` | Same as `lift`, but exceptions → `None` |
| `Option.apply(fn, arg)` | Apply `Option<Fn>` to `Option<Arg>` (applicative) |
| `Option.id(opt)` | Identity — useful for flattening `Option<Option<T>>` |

```typescript
// Lift a parser that might return undefined
const parseIntSafe = Option.lift(parseInt, Option.fromCoercible);
parseIntSafe("42");  // Some(42)
parseIntSafe("abc"); // None (NaN is falsy)

// Lift a function that throws
const parseJSON = Option.liftFallible(JSON.parse);
parseJSON('{"a":1}'); // Some({a: 1})
parseJSON('invalid'); // None
```

#### Collection Helpers (`Options` namespace)

| Helper | Returns | Behavior |
|--------|---------|----------|
| `Options.all(opts)` | `Option<T[]>` | All `Some` → `Some<T[]>`, any `None` → `None` |
| `Options.any(opts)` | `Option<T>` | First `Some` found, or `None` |
| `Options.areSome(opts)` | `boolean` | Type predicate: all are `Some` |
| `Options.areNone(opts)` | `boolean` | Type predicate: all are `None` |

---

### Result<T, E>

#### Constructors

| Constructor | Returns | Use When |
|-------------|---------|----------|
| `Ok(value)` | `Ok<T>` | Explicit success |
| `Err(error)` | `Err<E>` | Explicit failure |
| `Result(value)` | `Result<T, E>` | Auto-detect — `Error` instances → `Err` |
| `Result.from(fn)` | `Result<T, never>` | Lift infallible function (throws → propagate) |
| `Result.fromFallible(fn, errMapFn)` | `Result<T, E>` | Lift fallible function (throws → `Err`) |
| `Ok.empty()` | `Ok<Empty>` | Signal success without a value |
| `Err.empty()` | `Err<Empty>` | Signal failure without details |

```typescript
// Auto-detection for union types
const value: string | TypeError = getString();
Result(value); // Ok<string> or Err<TypeError> based on runtime type

// Lift sync functions
const safeDivide = Result.fromFallible(
  riskyDivision,
  (e) => new MathError("Division failed", { cause: e })
);
```

#### Composability Helpers

| Helper | Purpose |
|--------|---------|
| `Result.lift(fn, ctor?)` | Wrap function to return `Result` (panics propagate) |
| `Result.liftFallible(fn, errMapFn, ctor?)` | Wrap function, map exceptions to `Err<E>` |
| `asInfallible` | Error mapper that re-throws — marks function as "should never fail" |

```typescript
// Integrate a library function that throws
import * as semver from "semver";

const tryParse = Result.liftFallible(
  semver.parse,
  (e) => new TypeError("Invalid semver", { cause: e })
);

Ok("1.2.3").andThen(tryParse); // Ok<SemVer>
Ok("bad").andThen(tryParse);   // Err<TypeError>

// Mark a function as infallible (will throw if it actually fails)
const mustParse = Result.fromFallible(
  () => JSON.parse(trustedInput),
  asInfallible // "I promise this won't throw"
);
```

#### Collection Helpers (`Results` namespace)

| Helper | Returns | Behavior |
|--------|---------|----------|
| `Results.all(results)` | `Result<T[], E>` | All `Ok` → `Ok<T[]>`, first `Err` short-circuits |
| `Results.any(results)` | `Result<T, E[]>` | First `Ok` found, or all `Err`s collected |

```typescript
// Validate multiple fields, fail on first error. Supports tuples!
const validated = Results.all([
  validateName(input.name),
  validateEmail(input.email),
  validateAge(input.age),
] as const);
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

| Constructor | Returns | Use When |
|-------------|---------|----------|
| `Task.succeed(value)` | `Task<T, never>` | Immediate success |
| `Task.fail(error)` | `Task<never, E>` | Immediate failure |
| `Task.of(result)` | `Task<T, E>` | From `Result<T,E>` or `Promise<Result<T,E>>` |
| `Task.from(fn)` | `Task<T, E>` | From function returning `Result` or `Promise<Result>` |
| `Task.fromPromise(promise, errMapFn)` | `Task<T, E>` | From `Promise<T>`, map rejections to `Err` |
| `Task.fromFallible(fn, errMapFn)` | `Task<T, E>` | From async function that might throw |
| `Task.deferred()` | `DeferredTask<T, E>` | For push-based APIs (callbacks, events) |

```typescript
// Wrap fetch with proper error handling
const fetchJson = <T>(url: string): Task<T, FetchError> =>
  Task.fromPromise(
    fetch(url).then(r => r.json()),
    (e) => new FetchError(url, { cause: e })
  );

// Deferred task for callback or push based APIs
const { task, succeed, fail } = Task.deferred<Data, TimeoutError>();
setTimeout(() => fail(new TimeoutError()), 5000);
legacyApi.fetch((err, data) => err ? fail(err) : succeed(data));
await task; // Resolves when either callback fires
```

#### Composability Helpers

| Helper | Purpose |
|--------|---------|
| `Task.liftFallible(fn, errMapFn, ctor?)` | Wrap async function, map exceptions to `Err<E>` |

```typescript
// Lift an async library function
const tryFetch = Task.liftFallible(
  async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  (e) => new ApiError("Request failed", { cause: e })
);

// Use in pipelines
Task.succeed("/api/users")
  .andThen(tryFetch)
  .map(users => users.filter(u => u.active))
  .inspectErr(console.error);
```

#### Collection Helpers (`Tasks` namespace)

| Helper | Returns | Behavior |
|--------|---------|----------|
| `Tasks.all(tasks)` | `Task<T[], E>` | All succeed → `Ok<T[]>`, first failure short-circuits |
| `Tasks.any(tasks)` | `Task<T, E[]>` | First success, or all failures collected |

```typescript
// These work for all iterables
// Parallel fetch with combined results
const allData = await Tasks.all([
  fetchUsers(),
  fetchProducts(),
  fetchOrders(),
] as const);
// Result<[User[], Product[], Order[]], ApiError>

// Race multiple sources
const fastestResponse = await Tasks.any([
  fetchFromPrimary(),
  fetchFromReplica(),
  fetchFromCache(),
] as const);
// Result<Data, [PrimaryError, ReplicaError, CacheError]>
```

---

## Key Patterns

### Railway-Oriented Programming

Build pipelines where success flows forward and errors short-circuit:

```typescript
function processOrder(orderId: string): Task<Receipt, OrderError> {
  return getOrder(orderId)           // Task<Order, NotFoundError>
    .andThen(validateOrder)          // Task<Order, ValidationError>
    .andThen(processPayment)         // Task<Payment, PaymentError>
    .andThen(generateReceipt)        // Task<Receipt, ReceiptError>
    .inspectErr(logError);           // Log any error transparently
}
```

### Pass-through Conditionals

Validate without consuming the value:

```typescript
function saveFile(path: string): Result<void, Error> {
  return Ok(path)
    .andEnsure(validatePath)    // Validate, but keep original path
    .andEnsure(checkPermissions) // Check permissions, keep path
    .andThen(writeFile);         // Finally use the path
}
```

---

## Best Practices

1. **Computations, not data** — Use these abstractions for operation results, not data models
2. **Embrace immutability** — Don't mutate wrapped values
3. **Unwrap at the edges** — Keep Result/Task types in your domain logic; unwrap at API boundaries
4. **Some errors are fatal** — It's okay to throw for truly unrecoverable states
5. **Lift external code** — Use `liftFallible` to integrate libraries cleanly

---

## Performance

These abstractions have **virtually no overhead** compared to traditional exception handling. In benchmarks, the linear return path often performs slightly better than nested try/catch blocks:

```
Synchronous:  Result flow ~1.3x faster than exceptions
Asynchronous: Task flow   ~1.0x (equivalent performance)
```

Your mileage will vary though.
Run benchmarks yourself: `deno bench`

---

## Attribution

**aetherway** is a fork of [eitherway](https://github.com/realpha/eitherway), originally created by [realpha](https://github.com/realpha) (0xrealpha@proton.me).


### License

MIT License — see [LICENSE.md](./LICENSE.md)

- Original eitherway: Copyright © 2023-2025 realpha
- aetherway modifications: Copyright © 2026 aedge-io

---

## Resources

- [Original eitherway documentation](https://deno.land/x/eitherway)
- ["Railway-oriented programming" — Scott Wlaschin](https://vimeo.com/113707214)
- ["Boundaries" — Gary Bernhardt](https://www.destroyallsoftware.com/talks/boundaries)
- ["Errors are values" — Rob Pike](https://go.dev/blog/errors-are-values)
