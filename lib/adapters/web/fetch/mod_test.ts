import { Task } from "../../../async/task.ts";
import { Err, Ok } from "../../../core/result.ts";

import {
  assert,
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertObjectMatch,
  assertStrictEquals,
} from "@std/assert";
import { assertType, type IsExact } from "@std/testing/types";
import {
  FailedRequest,
  FetchException,
  isFetchException,
  liftFetch,
  toFetchResult,
} from "./mod.ts";

/**
 * A stub replacement for `fetch` that returns a successful JSON response
 * without making any network requests. Matches the `fetch` signature.
 */
function fetchStub(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  void init;
  const url = typeof input === "string"
    ? input
    : input instanceof URL
    ? input.href
    : input.url;

  // Simulate a user response for the jsonplaceholder URL pattern
  const userIdMatch = url.match(/\/users\/(\d+)/);
  if (userIdMatch) {
    const id = Number(userIdMatch[1]);
    return Promise.resolve(Response.json({ id }));
  }

  return Promise.resolve(Response.json({}));
}

Deno.test("eitherway::adapters::web::fetch", async (t) => {
  await t.step("FailedRequest<R>", async (t) => {
    await t.step(".from() -> produces a new generic instance", () => {
      const responseLike = {
        ok: false,
        status: 0,
        statusText: "NetworkError",
      } as const;
      type RL = typeof responseLike;

      const error = FailedRequest.from(responseLike);
      type Inner = typeof error.response;

      assertType<IsExact<Inner, RL>>(true);
      assertStrictEquals(error.name, "FailedRequest");
      assertStrictEquals(error.status, responseLike.status);
      assertStrictEquals(error.statusText, responseLike.statusText);
      assertStrictEquals(error.response, responseLike);
    });

    await t.step(
      ".with() -> produces a new instance with status properties",
      () => {
        const status = 500;
        const statusText = "Internal Server Error";

        const error = FailedRequest.with(status, statusText);
        const internalResponse = error.response;

        assertType<IsExact<typeof error, FailedRequest<Response>>>(true);
        assertType<IsExact<typeof internalResponse, Response>>(true);
        assertStrictEquals(error.status, internalResponse.status);
        assertStrictEquals(error.statusText, internalResponse.statusText);
      },
    );

    await t.step(".toJSON() -> produces a serializalbe representation", () => {
      const status = 500;
      const statusText = "Internal Server Error";

      const error = FailedRequest.with(status, statusText);

      assertStrictEquals(
        JSON.stringify(error),
        JSON.stringify({ status, statusText }),
      );
    });
  });

  await t.step("FetchException", async (t) => {
    await t.step(".from() -> produces new instance", () => {
      const cause = "Something went wrong";

      const exception = FetchException.from(cause);

      assertInstanceOf(exception.cause, Error);
      assertStrictEquals(
        (exception.cause as Error).message,
        "Unknown exception",
      );
      assertStrictEquals((exception.cause as Error).cause, cause);
      assertStrictEquals(exception.name, "FetchException");
    });

    await t.step("isFetchException() -> narrows to FetchException", () => {
      const exception = FetchException.from("Something went wrong");
      const plainError = Error("Something went wrong");
      const unkwn = "Unknown" as unknown;

      if (isFetchException(unkwn)) {
        assertType<IsExact<typeof unkwn, FetchException>>(true);
      }

      assertStrictEquals(isFetchException(exception), true);
      assertStrictEquals(isFetchException(plainError), false);
      assertStrictEquals(isFetchException(unkwn), false);
      assertStrictEquals(isFetchException(undefined), false);
    });
  });

  await t.step("toFetchResult", async (t) => {
    await t.step(
      "() -> returns an instance of Err<FailedRequest<R>> for non-ok response like inputs",
      () => {
        const errorResponse = Response.error();

        const err = toFetchResult(errorResponse);
        const unwrapped = err.unwrap();

        assertType<
          IsExact<typeof unwrapped, Response | FailedRequest<Response>>
        >(true);
        assertStrictEquals(err.isErr(), true);
        assertInstanceOf(unwrapped, FailedRequest);
        assertStrictEquals((unwrapped as FailedRequest<Response>).status, 0);
        assertStrictEquals(
          (unwrapped as FailedRequest<Response>).response,
          errorResponse,
        );
      },
    );

    await t.step(
      "() -> returns an instance of Ok<R> for ok response like inputs",
      () => {
        const response = Response.json({ id: 1 });

        const ok = toFetchResult(response);
        const unwrapped = ok.unwrap();

        assertType<
          IsExact<typeof unwrapped, Response | FailedRequest<Response>>
        >(true);
        assertStrictEquals(ok.isErr(), false);
        assertStrictEquals(unwrapped, response);
      },
    );
  });

  await t.step("liftFetch", async (t) => {
    /*
     * Shared interfaces
     */
    interface User {
      id: number;
    }
    interface UserResponse extends Response {
      json(): Promise<User>;
    }

    await t.step(
      "() -> lifts untyped fetch with default errMapFn and ctor",
      async () => {
        const testUrl = "https://jsonplaceholder.typicode.com/users/1";

        const lifted = liftFetch(fetchStub);
        const result = await lifted(testUrl)
          .trip(() => Task.succeed("Just to test"))
          .inspectErr(console.error)
          .map((response) => response.json());

        assertType<
          IsExact<Parameters<typeof lifted>, Parameters<typeof fetchStub>>
        >(true);
        assertType<
          IsExact<
            ReturnType<typeof lifted>,
            Task<Response, FailedRequest<Response> | FetchException>
          >
        >(true);
        assertStrictEquals(result.isOk(), true);
        assertExists(result.unwrap());
      },
    );

    await t.step(
      "() -> lifts typed fetch with defauft errMapFn and ctor",
      async () => {
        async function getUser(id: number): Promise<UserResponse> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return Response.json({ id });
        }

        const lifted = liftFetch(getUser);

        const result = await lifted(1)
          .map((response) => response.json())
          .inspect((user) => assertType<IsExact<typeof user, User>>(true));

        assertType<
          IsExact<Parameters<typeof lifted>, Parameters<typeof getUser>>
        >(true);
        assertType<
          IsExact<
            ReturnType<typeof lifted>,
            Task<
              UserResponse,
              FailedRequest<UserResponse> | FetchException
            >
          >
        >(true);
        assertStrictEquals(result.isOk(), true);
        assertEquals(result.unwrap(), { id: 1 });
      },
    );

    await t.step(
      "() -> propagates errors correctly via the Err path",
      async () => {
        function getUserNotFound(_id: number): Promise<UserResponse> {
          return Promise.resolve(
            new Response(null, { status: 404, statusText: "Not Found" }),
          );
        }

        const lifted = liftFetch(getUserNotFound);

        const result = await lifted(11);

        assertType<
          IsExact<Parameters<typeof lifted>, Parameters<typeof getUserNotFound>>
        >(true);
        assertType<
          IsExact<
            ReturnType<typeof lifted>,
            Task<
              UserResponse,
              FailedRequest<UserResponse> | FetchException
            >
          >
        >(true);
        if (result.isOk()) {
          assert(false);
        }
        const err = result.unwrap();
        if (isFetchException(err)) {
          assert(false);
        }
        assertInstanceOf(err, FailedRequest);
        assertStrictEquals(err.status, 404);
        assertStrictEquals(err.statusText, "Not Found");
      },
    );

    await t.step(
      "() -> propagates exceptions correctly via the Err path",
      async () => {
        async function failingFetch(_id: number): Promise<UserResponse> {
          await new Promise((resolve) => setTimeout(resolve, 100));
          throw new Error("Network error");
        }

        const lifted = liftFetch(failingFetch);

        const result = await lifted(11);

        assertType<
          IsExact<Parameters<typeof lifted>, Parameters<typeof failingFetch>>
        >(true);
        assertType<
          IsExact<
            ReturnType<typeof lifted>,
            Task<
              UserResponse,
              FailedRequest<UserResponse> | FetchException
            >
          >
        >(true);
        assertStrictEquals(result.isErr(), true);
        assertInstanceOf(result.unwrap(), FetchException);
        assertStrictEquals(
          (result.unwrap() as FetchException).name,
          "FetchException",
        );
        assertInstanceOf((result.unwrap() as FetchException).cause, Error);
        assertStrictEquals(
          ((result.unwrap() as FetchException).cause as Error).message,
          "Network error",
        );
      },
    );

    await t.step(
      "() -> lifts provided fetch like fn with custom errMapFn and ctor",
      async () => {
        const testUrl = "https://jsonplaceholder.typicode.com/users/1";
        async function ctor(res: UserResponse) {
          if (res.ok) return Ok(await res.json());
          return Err(TypeError("Oh no", { cause: res }));
        }
        const errMapFn = (cause: unknown) => TypeError("Dunno", { cause });

        const lifted = liftFetch(fetchStub, ctor, errMapFn);
        const result = await lifted(testUrl);

        assertType<
          IsExact<Parameters<typeof lifted>, Parameters<typeof fetchStub>>
        >(true);
        assertType<
          IsExact<
            ReturnType<typeof lifted>,
            Task<
              User,
              TypeError | TypeError
            >
          >
        >(true);
        assertStrictEquals(result.isOk(), true);
        assertObjectMatch(result.unwrap(), { id: 1 });
      },
    );
  });
});
