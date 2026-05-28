import type { INestApplicationContext } from "@nestjs/common";
import { BirthdayAutomationService } from "../birthday-automation/index.js";
import type { AutomationRunResult } from "../automation/index.js";
import type { WhatsAppClient } from "../integrations/index.js";
import { WHATSAPP_CLIENT } from "../whatsapp/index.js";
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
    const result = await context.get(BirthdayAutomationService).runToday("manual", options.now);
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
