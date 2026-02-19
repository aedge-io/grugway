#!/usr/bin/env -S deno run -A
import { $ } from "@david/dax";
import { Cmd, runPipeline, Step } from "grugway/pipeline";

const root = await $`git rev-parse --show-toplevel`.text();
const staged = (await $`git diff \
  --cached \
  --name-only \
  --diff-filter=ACMR`
  .lines()).map((file) => $.path(root).join(file));

await runPipeline({
  name: "PRE-COMMIT:",
  steps: [
    Step("FMT", "fmt staged files...", Cmd($`deno fmt -q ${staged}`)),
    Step("GIT", "re-add to the index...", Cmd($`git add ${staged}`)),
  ],
});
