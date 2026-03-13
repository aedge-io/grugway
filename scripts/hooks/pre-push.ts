#!/usr/bin/env -S deno run -A

import { $ } from "grugway/shell";
import { Cmd, runPipeline, Step } from "grugway/pipeline";

await runPipeline({
  name: "[Pre-push]>",
  steps: [
    Step("check", "running type checks...", Cmd($`deno check -q --doc`)),
    Step("lint", "running linter...", Cmd($`deno lint -q`)),
    Step(
      "test",
      "running tests...",
      Cmd($`deno test --parallel --fail-fast`, "both"),
    ),
  ],
});
