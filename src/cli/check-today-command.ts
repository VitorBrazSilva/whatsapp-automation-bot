import { createBirthdayBotRuntime, type CreateBirthdayBotRuntimeOptions } from "../app.js";
import type { CheckResult } from "../domain/index.js";

export interface CheckTodayCommandResult {
  result: CheckResult;
}

export interface CheckTodayCommandOptions extends CreateBirthdayBotRuntimeOptions {
  stdout?: (line: string) => void;
}

export async function runCheckTodayCommand(
  options: CheckTodayCommandOptions = {}
): Promise<CheckTodayCommandResult> {
  const stdout = options.stdout ?? console.log;
  const runtime = await createBirthdayBotRuntime({
    ...options,
    requireOperationalConfig: options.requireOperationalConfig ?? true
  });
  try {
    await runtime.whatsappClient.connect();
    const result = await runtime.birthdayService.runDailyCheck({
      trigger: "manual",
      now: runtime.now()
    });
    stdout(
      JSON.stringify({
        event: "birthday.check_today.completed",
        ...result,
        processedAt: result.processedAt.toISOString()
      })
    );
    return { result };
  } finally {
    await runtime.close();
  }
}
