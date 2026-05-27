import {
  createBirthdayBotRuntime,
  type BirthdayBotRuntime,
  type CreateBirthdayBotRuntimeOptions
} from "./app.js";
import type { CheckResult } from "./domain/index.js";

export interface StartProcessOptions extends CreateBirthdayBotRuntimeOptions {
  installSignalHandlers?: boolean;
}

export async function startProcess(options: StartProcessOptions = {}): Promise<BirthdayBotRuntime> {
  const runtime = await createBirthdayBotRuntime({
    ...options,
    requireOperationalConfig: options.requireOperationalConfig ?? true
  });
  try {
    runtime.whatsappClient.onReady(async () => {
      const result = await runtime.birthdayService.runRecoveryCheck({
        reason: "whatsapp-reconnect",
        now: runtime.now()
      });
      logEvent("birthday.recovery.completed", result);
    });

    await runtime.whatsappClient.connect();
    const startupRecovery = await runtime.birthdayService.runRecoveryCheck({
      reason: "startup",
      now: runtime.now()
    });
    logEvent("birthday.startup_recovery.completed", startupRecovery);
    await runtime.scheduler.start();

    console.log(
      JSON.stringify({
        event: "app.started",
        status: runtime.status,
        timezone: runtime.config.timezone,
        dailyCheckTime: runtime.config.dailyCheckTime,
        databaseConfigured: runtime.config.databasePath.length > 0,
        whatsappAuthConfigured: runtime.config.whatsappAuthDir.length > 0,
        whatsappGroupConfigured: runtime.config.whatsappGroupId !== null,
        openAiConfigured: runtime.config.openAiApiKeyConfigured
      })
    );

    if (options.installSignalHandlers ?? true) {
      installShutdownHandlers(runtime);
    }

    return runtime;
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

function logEvent(event: string, result: CheckResult): void {
  console.log(
    JSON.stringify({
      event,
      ...result,
      processedAt: result.processedAt.toISOString()
    })
  );
}

function installShutdownHandlers(runtime: BirthdayBotRuntime): void {
  const shutdown = (signal: NodeJS.Signals) => {
    void runtime
      .close()
      .then(() => {
        console.log(JSON.stringify({ event: "app.stopped", signal }));
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            event: "app.stop_failed",
            signal,
            errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
            errorMessage: error instanceof Error ? error.message : "Unknown error."
          })
        );
        process.exit(1);
      });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
