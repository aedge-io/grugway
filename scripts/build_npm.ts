import { Err, Ok, type Result, Task } from "@aedge-io/grugway";
import {
  dirIsEmpty,
  parseVersion,
  releaseVersionsMatch,
  ScriptErrors,
  type SemVer,
} from "./build_helpers.ts";
import { build } from "@deno/dnt";
import * as semver from "@std/semver";

const MAIN_CONFIG_FILE = import.meta.resolve("../deno.jsonc");
const PKG_NAME = "@aedge-io/grugway";
const ENTRY_POINT = "./lib/mod.ts";
const OUT_DIR = "./npm";
const LICENSE = "./LICENSE.md";
const README = "./README.md";
const GIT_URL = "git+https://github.com/aedge-io/grugway.git";
const ISSUE_URL = "https://github.com/aedge-io/grugway/issues";

async function buildPackage(v: SemVer): Promise<Result<void, Error>> {
  try {
    await build({
      configFile: MAIN_CONFIG_FILE,
      entryPoints: [ENTRY_POINT],
      outDir: OUT_DIR,
      typeCheck: "both",
      declaration: "separate",
      scriptModule: "cjs",
      test: false,
      shims: {
        deno: false,
      },
      package: {
        name: PKG_NAME,
        version: semver.format(v),
        description:
          "Safe abstractions for fallible flows for humans and clankers alike",
        license: "MIT",
        author: "aedge-io <os@aedge.io>",
        engines: {
          "node": ">=17.0.0", //needed for structuredClone
        },
        repository: {
          type: "git",
          url: GIT_URL,
        },
        bugs: {
          url: ISSUE_URL,
        },
        keywords: [
          "async",
          "clanker",
          "clankers",
          "clanker-friendly",
          "either",
          "error",
          "errors",
          "error-handling",
          "fallible",
          "functional",
          "maybe",
          "monad",
          "option",
          "result",
          "task",
          "typescript",
        ],
      },
      compilerOptions: {
        lib: ["DOM", "ES2022"], //needed for structuredClone
        target: "ES2022",
      },
      postBuild() {
        Deno.copyFileSync(LICENSE, `${OUT_DIR}/LICENSE.md`);
        Deno.copyFileSync(README, `${OUT_DIR}/README.md`);
        Deno.removeSync(`${OUT_DIR}/src`, { recursive: true });
      },
    });
    return Ok(undefined);
  } catch (e: unknown) {
    return Err(ScriptErrors.BuildFailed(e));
  }
}

function main() {
  return parseVersion()
    .andEnsure(releaseVersionsMatch)
    .into(Task.of<SemVer, TypeError>)
    .andEnsure(() => dirIsEmpty(OUT_DIR))
    .andThen(buildPackage);
}

main().then((res) => {
  const code = res
    .inspect(() => console.log("Build succeeded!"))
    .inspectErr(console.error)
    .mapOr(() => 0, 1)
    .unwrap();

  Deno.exit(code);
});
