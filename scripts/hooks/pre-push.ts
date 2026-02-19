#!/usr/bin/env -S deno run -A
import $ from "@david/dax";
import { Cmd, runPipeline, Step } from "grugway/pipeline";

await runPipeline({
  name: "PRE-PUSH:",
  steps: [
    Step("CHECK", "running type checks...", Cmd($`deno check -q --doc`)),
    Step("LINT", "running linter...", Cmd($`deno lint -q`)),
    Step(
      "TEST",
      "running tests...",
      Cmd($`deno test --parallel --fail-fast`, "both"),
    ),
  ],
});
