#!/usr/bin/env -S deno run -A --cached-only

import { manifest } from "grugway/metadata";
import { tryParse } from "grugway/version";
import { Task } from "@aedge-io/grugway";

await tryParse(Deno.args[0]).into((res) => Task.of(res)).andThen((v) =>
  manifest.withBumpedVersion(v).flush()
);
