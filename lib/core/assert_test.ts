import { assertThrows } from "@std/assert";
import { assertNotNullish } from "./assert.ts";
import { Panic } from "./errors.ts";

Deno.test("grugway::core::assert", async (t) => {
  await t.step("assertNotNullish() -> panics if expression is nullish", () => {
    assertThrows(
      () => {
        assertNotNullish(undefined);
      },
      Panic,
      "expected non-nullish value",
    );
  });
});
