import type { INestApplicationContext } from "@nestjs/common";
import {
  ListAutomationTargetsUseCase,
  type AutomationTargetLink,
  type TargetConfigurationPort
} from "../../application/index.js";
import { TARGET_CONFIGURATION_PORT } from "../../infrastructure/index.js";
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
    const targets = await new ListAutomationTargetsUseCase(
      context.get<TargetConfigurationPort>(TARGET_CONFIGURATION_PORT)
    ).execute(automationKey);
    stdout(JSON.stringify({ event: "targets.list.completed", targets }, null, 2));
    return { targets };
  } finally {
    if (ownsContext) {
      await context.close();
    }
  }
}
