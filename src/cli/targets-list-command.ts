import type { INestApplicationContext } from "@nestjs/common";
import { TargetsService, type AutomationTargetLink } from "../targets/index.js";
import { createCommandContext } from "./application-context.js";

export interface TargetsListCommandOptions {
  args?: string[];
  context?: INestApplicationContext;
  env?: NodeJS.ProcessEnv;
  stdout?: (line: string) => void;
}

export interface TargetsListCommandResult {
  targets: AutomationTargetLink[];
}

export async function runTargetsListCommand(
  options: TargetsListCommandOptions = {}
): Promise<TargetsListCommandResult> {
  const stdout = options.stdout ?? console.log;
  const args = options.args ?? process.argv.slice(2);
  const automationKey = args[0];
  const context = options.context ?? (await createCommandContext({ env: options.env }));
  const ownsContext = options.context === undefined;
  try {
    const targets = await context.get(TargetsService).listAutomationTargets(automationKey);
    stdout(JSON.stringify({ event: "targets.list.completed", targets }, null, 2));
    return { targets };
  } finally {
    if (ownsContext) {
      await context.close();
    }
  }
}
