import type { INestApplicationContext } from "@nestjs/common";
import { TargetsService } from "../targets/index.js";
import { createCommandContext } from "./application-context.js";

export interface TargetsAddCommandOptions {
  args?: string[];
  context?: INestApplicationContext;
  env?: NodeJS.ProcessEnv;
  stdout?: (line: string) => void;
}

export async function runTargetsAddCommand(options: TargetsAddCommandOptions = {}): Promise<void> {
  const stdout = options.stdout ?? console.log;
  const args = options.args ?? process.argv.slice(2);
  const automationKey = args[0];
  const groupJid = args[1];
  const displayName = args[2];
  if (automationKey === undefined || groupJid === undefined) {
    throw new Error("Usage: targets:add -- <automationKey> <groupJid> [displayName]");
  }
  const context =
    options.context ??
    (await createCommandContext({
      env: options.env,
      ensureLegacyTargets: false
    }));
  const ownsContext = options.context === undefined;
  try {
    await context.get(TargetsService).addGroupTarget(automationKey, groupJid, displayName);
    stdout(
      JSON.stringify({
        event: "target.config.changed",
        action: "added",
        automationKey,
        groupJid
      })
    );
  } finally {
    if (ownsContext) {
      await context.close();
    }
  }
}
