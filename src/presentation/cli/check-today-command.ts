import type { INestApplicationContext } from "@nestjs/common";
import {
  AUTOMATION_RUNNER,
  type AutomationRunResult,
  type AutomationRunner
} from "../../automation/index.js";
import { BIRTHDAY_AUTOMATION_KEY } from "../../domain/index.js";
import type { WhatsAppClient } from "../../infrastructure/index.js";
import { WHATSAPP_CLIENT } from "../../whatsapp/index.js";
import { createCommandContext } from "./application-context.js";

export interface CheckTodayCommandResult {
  result: AutomationRunResult;
}

export interface CheckTodayCommandOptions {
  context?: INestApplicationContext;
  env?: NodeJS.ProcessEnv;
  now?: Date;
  stdout?: (line: string) => void;
}

export async function runCheckTodayCommand(
  options: CheckTodayCommandOptions = {}
): Promise<CheckTodayCommandResult> {
  const stdout = options.stdout ?? console.log;
  const context = options.context ?? (await createCommandContext({ env: options.env }));
  const ownsContext = options.context === undefined;
  try {
    const whatsappClient = context.get<WhatsAppClient>(WHATSAPP_CLIENT);
    await whatsappClient.connect();
    const result = await context
      .get<AutomationRunner>(AUTOMATION_RUNNER)
      .run(BIRTHDAY_AUTOMATION_KEY, "manual", options.now ?? new Date());
    stdout(
      JSON.stringify({
        event: "birthdays.check_today.completed",
        trigger: "manual",
        ...result
      })
    );
    return { result };
  } finally {
    if (ownsContext) {
      await (
        context.get<WhatsAppClient>(WHATSAPP_CLIENT) as { close?: () => Promise<void> }
      ).close?.();
      await context.close();
    }
  }
}
