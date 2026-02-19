#!/usr/bin/env -S deno run -A
import $ from "@david/dax";

const projectRoot = $.path(import.meta.url).join("../..");
const gitHooksDir = projectRoot.join(".git", "hooks");

if (!gitHooksDir.existsSync()) {
  $.logError("Not a git repository (no .git/hooks directory found).");
  Deno.exit(1);
}

async function installHook(hookName: string, sourcePath: string) {
  const source = projectRoot.join(sourcePath);
  const target = gitHooksDir.join(hookName);

  $.logStep(`Linking ${hookName} -> ${sourcePath}...`);

  if (target.existsSync()) {
    await target.remove();
  }

  await $`ln -sf ${source} ${target}`;

  await $`chmod +x ${source}`;

  $.logStep(`Hook ${hookName} installed.`);
}

await installHook("pre-commit", "scripts/hooks/pre-commit.ts");
await installHook("pre-push", "scripts/hooks/pre-push.ts");

$.logLight("Hooks installed successfully via symlinks.");
