import { format, type SemVer } from "grugway/version";
import { $ } from "grugway/shell";
import { Manifest } from "grugway/manifest";

const root = $.path(import.meta.url).parentOrThrow().parentOrThrow();
const denoJsonc = root.join("deno.jsonc");

export const manifest = await Manifest.loadFrom(denoJsonc);

export const paths = {
  root,
  changelog: root.join("CHANGELOG.md"),
  changesDir: root.join("docs/changes"),
  denoJsonc,
  libEntryPoint: root.join("lib/mod.ts"),
  libEntryPoints: [
    "lib/mod.ts",
    { name: "./clone", path: "lib/core/clone.ts" },
  ],
  license: root.join("LICENSE.md"),
  npmDir: root.join("npm"),
  readme: root.join("README.md"),
  planDir: root.join(".release"),
  planJson: root.join(".release/plan.json"),
  planChangelog: root.join(".release/changelog.md"),
  planChange: (ver: SemVer) => paths.planDir.join(`${format(ver)}.md`),
  change: (ver: SemVer) => paths.changesDir.join(`${format(ver)}.md`),
} as const;

export const git = {
  defaultBranch: "main",
  repo: new URL("https://github.com/aedge-io/grugway"),
  remote: new URL("git+https://github.com/aedge-io/grugway.git"),
  issues: new URL("https://github.com/aedge-io/grugway/issues"),
} as const;
