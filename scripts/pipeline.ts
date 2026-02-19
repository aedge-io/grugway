import $, { CommandBuilder, CommandResult } from "@david/dax";
import { Err, None, Ok, Option, Some, Task } from "grugway";

type ErrorChannel = "stderr" | "stdout" | "both";
type TerminatorFn = (cmdRes: CommandResult) => void;

export type Cmd = {
  cmd: CommandBuilder;
  errChannel: ErrorChannel;
  terminatorFn: Option<TerminatorFn>;
};
export function Cmd(
  cmd: CommandBuilder,
  errChannel: ErrorChannel = "stderr",
  terminatorFn: Option<TerminatorFn> = Some(terminate),
): Cmd {
  return { cmd, errChannel, terminatorFn };
}

export type Step = {
  name: string;
  description: string;
  cmd: Cmd;
};
export function Step(
  name: string,
  description: string,
  cmd: Cmd,
): Step {
  return { name, description, cmd };
}

export type PipelineDefinition = {
  name: string;
  steps: Step[];
};

export async function runPipeline({ name, steps }: PipelineDefinition) {
  let err: Option<CommandResult> = None;
  let terminatorFn: Option<TerminatorFn> = None;
  pipeline: for (const step of steps) {
    terminatorFn = step.cmd.terminatorFn;
    const pb = $.progress(name);
    const stepRes = await pb.message(step.description).with(() => {
      return runStep(
        step.name,
        step.cmd,
      );
    });
    if (stepRes.isErr() && terminatorFn.isSome()) {
      err = stepRes.err();
      break pipeline;
    }
  }
  Option.apply(terminatorFn, err);
}

function runStep(
  name: string,
  cmdDef: Cmd,
) {
  const { cmd, errChannel } = cmdDef;
  const reporter = errorReporter(name, errChannel);
  return Task.of(
    cmd.noThrow().stdout("piped").stderr("piped").then((cmdResult) => {
      if (cmdResult.code !== 0) return Err(cmdResult);
      return Ok(cmdResult);
    }),
  ).inspectErr(reporter);
}

function errorReporter(name: string, errChannel: ErrorChannel) {
  switch (errChannel) {
    case "both":
      return (res: CommandResult) => {
        $.logError(name, res.stderr);
        $.logError(name, res.stdout);
      };
    case "stderr":
      return (res: CommandResult) => {
        $.logError(name, res.stderr);
      };
    case "stdout":
      return (res: CommandResult) => {
        $.logError(name, res.stdout);
      };
  }
}

function terminate(cmdRes: CommandResult) {
  Deno.exit(cmdRes.code);
}
