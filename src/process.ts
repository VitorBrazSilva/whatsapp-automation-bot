import {
  createBirthdayBotRuntime,
  type BirthdayBotRuntime,
  type CreateBirthdayBotRuntimeOptions
} from "./app.js";
import type { CheckResult } from "./domain/index.js";
import { readErrorCode, readErrorMessage } from "./observability/index.js";

export interface StartProcessOptions extends CreateBirthdayBotRuntimeOptions {
  installSignalHandlers?: boolean;
}

export async function startProcess(options: StartProcessOptions = {}): Promise<BirthdayBotRuntime> {
  const runtime = await createBirthdayBotRuntime({
    ...options,
    requireOperationalConfig: options.requireOperationalConfig ?? true
  });
  try {
    if (runtime.metricsServer !== null) {
      await runtime.metricsServer.start();
      runtime.logger.info({
        event: "metrics.server.started",
        host: runtime.config.metrics.host,
        port: runtime.config.metrics.port
      });
    }
    runtime.whatsappClient.onReady(async () => {
      const result = await runtime.birthdayService.runRecoveryCheck({
        reason: "whatsapp-reconnect",
        now: runtime.now()
      });
      logEvent(runtime, "birthday.recovery.completed", result);
    });

    await runtime.whatsappClient.connect();
    const startupRecovery = await runtime.birthdayService.runRecoveryCheck({
      reason: "startup",
      now: runtime.now()
    });
    logEvent(runtime, "birthday.startup_recovery.completed", startupRecovery);
    await runtime.scheduler.start();

    runtime.logger.info({
      event: "app.started",
      status: runtime.status,
      timezone: runtime.config.timezone,
      dailyCheckTime: runtime.config.dailyCheckTime,
      databaseConfigured: runtime.config.databasePath.length > 0,
      whatsappAuthConfigured: runtime.config.whatsappAuthDir.length > 0,
      whatsappGroupConfigured: runtime.config.whatsappGroupId !== null,
      openAiConfigured: runtime.config.openAiApiKeyConfigured,
      metricsEnabled: runtime.config.metrics.enabled
    });

    if (options.installSignalHandlers ?? true) {
      installShutdownHandlers(runtime);
    }

    return runtime;
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

function logEvent(runtime: BirthdayBotRuntime, event: string, result: CheckResult): void {
  runtime.logger.info({
    event,
    ...result,
    processedAt: result.processedAt.toISOString()
  });
}

function installShutdownHandlers(runtime: BirthdayBotRuntime): void {
  const shutdown = (signal: NodeJS.Signals) => {
    void runtime
      .close()
      .then(() => {
        runtime.logger.info({ event: "app.stopped", signal });
        process.exit(0);
      })
      .catch((error: unknown) => {
        runtime.logger.error({
          event: "app.stop_failed",
          signal,
          errorCode: readErrorCode(error),
          errorMessage: readErrorMessage(error)
        });
        process.exit(1);
      });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
