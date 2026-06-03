import type { INestApplicationContext } from "@nestjs/common";
import { RUN_BIRTHDAY_REMINDER_USE_CASE, WHATSAPP_CLIENT } from "../../infrastructure/index.js";
import type {
  BirthdayReminderResult,
  RunBirthdayReminderUseCasePort,
  WhatsAppGroupMessenger
} from "../../application/index.js";
import { createCommandContext } from "./application-context.js";

export interface CheckTodayCommandResult {
  result: BirthdayReminderResult;
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
    const whatsappClient = context.get<WhatsAppGroupMessenger>(WHATSAPP_CLIENT);
    await whatsappClient.connect();
    const result = await context
      .get<RunBirthdayReminderUseCasePort>(RUN_BIRTHDAY_REMINDER_USE_CASE)
      .execute({
        trigger: "manual",
        now: options.now ?? new Date()
      });
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
      await context.get<WhatsAppGroupMessenger>(WHATSAPP_CLIENT).close();
      await context.close();
    }
  }
}
