import { Err, Ok, Option, Result, Task } from "@aedge-io/grugway";
import { emptyDir } from "@deno/dnt";
import * as semver from "@std/semver";
import rawManifest from "../../deno.jsonc" with { type: "text" };
import { parse as parseJsonc } from "@std/jsonc";

const RELEASE_TYPES = ["major", "minor", "patch"] as const;
export type ReleaseType = typeof RELEASE_TYPES[number];
export function isValidRelease(value: string): value is ReleaseType {
  return (RELEASE_TYPES as readonly string[]).includes(value);
}
export type SemVer = semver.SemVer;
export const ScriptErrors = {
  NoVersionProvided: TypeError("Expected version specifier, received none"),
  NotVersioned: TypeError("Could not extract version from deno manifest"),
  VersionsDoNotMatch: (expected: SemVer, provided: SemVer) =>
    TypeError(
      `Expected version ${semver.format(expected)} but got ${
        semver.format(provided)
      }`,
    ),
  CouldNotPrepareDir: (e: unknown) =>
    Error(`Could not prepare directory`, { cause: e }),
  CouldNotCreateFile: (e: unknown) =>
    Error("Could not create file", { cause: e }),
  BuildFailed: (e: unknown) => Error(`Build failed`, { cause: e }),
} as const;

/**
 * {@linkcode semver.parse}
 */
export const tryParse = Result.liftFallible(
  semver.parse,
  (e: unknown) => e as TypeError,
);

export const tryParseJsonc = Result.liftFallible(
  parseJsonc,
  (e: unknown) => e as SyntaxError,
);

export interface Versioned {
  version: string;
}

export function isVersioned(value: unknown): value is Versioned {
  if (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.hasOwn(value, "version") &&
    typeof (value as Record<string, unknown>).version === "string"
  ) {
    return true;
  }
  return false;
}

export function parseVersioned(value: unknown): Result<Versioned, TypeError> {
  return Option(value).filter(isVersioned).okOr(ScriptErrors.NotVersioned);
}

export function releaseVersionsMatch(
  v: SemVer,
): Result<SemVer, TypeError | SyntaxError> {
  return tryParseJsonc(rawManifest)
    .andThen(parseVersioned)
    .andThen((manifest) => tryParse(manifest.version))
    .andThen((manifestVersion) =>
      semver.equals(manifestVersion, v)
        ? Ok(v)
        : Err(ScriptErrors.VersionsDoNotMatch(manifestVersion, v))
    );
}

/**
 * {@linkcode emptyDir}
 */
export const dirIsEmpty = Task.liftFallible(
  emptyDir,
  ScriptErrors.CouldNotPrepareDir,
);

export function parseVersion(): Result<SemVer, TypeError> {
  return Option.fromCoercible(Deno.args[0])
    .okOr(ScriptErrors.NoVersionProvided)
    .inspect((v) => console.log(`[build:npm] Using version specifier: ${v}`))
    .andThen(tryParse);
}
