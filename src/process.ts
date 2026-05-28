import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { BirthdayAutomationService } from "./birthday-automation/index.js";
import { APP_CONFIG, type AppConfig } from "./config/index.js";
import { DatabaseMigrationService } from "./database/index.js";
import type { WhatsAppClient } from "./integrations/index.js";
import {
  STRUCTURED_LOGGER,
  readErrorCode,
  readErrorMessage,
  type StructuredLogger
} from "./observability/index.js";
import { TargetsService } from "./targets/index.js";
import { WHATSAPP_CLIENT } from "./whatsapp/index.js";

export interface StartProcessOptions {
  env?: NodeJS.ProcessEnv;
  installSignalHandlers?: boolean;
  listen?: boolean;
  connectWhatsapp?: boolean;
}

export async function startProcess(options: StartProcessOptions = {}): Promise<INestApplication> {
  return withTemporaryEnv(options.env, async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    const config = app.get<AppConfig>(APP_CONFIG);
    const logger = app.get<StructuredLogger>(STRUCTURED_LOGGER);
    const migrations = app.get(DatabaseMigrationService);
    const targets = app.get(TargetsService);
    const birthdays = app.get(BirthdayAutomationService);
    const whatsappClient = app.get<WhatsAppClient>(WHATSAPP_CLIENT);
    app.enableShutdownHooks();
    await app.init();
    await migrations.runMigrations();
    await targets.ensureLegacyBirthdayTarget();
    whatsappClient.onReady(async () => {
      await birthdays.runToday("whatsapp-reconnect", new Date());
    });
    if (options.connectWhatsapp ?? true) {
      await whatsappClient.connect();
      await birthdays.runToday("startup", new Date());
    }
    if (options.listen ?? true) {
      await app.listen(config.http.port, config.http.host);
    }
    logger.info({
      event: "app.started",
      appName: config.appName,
      status: "ready",
      timezone: config.timezone,
      dailyCheckTime: config.dailyCheckTime,
      databaseConfigured: config.databasePath.length > 0,
      whatsappAuthConfigured: config.whatsappAuthDir.length > 0,
      legacyWhatsappGroupConfigured: config.whatsappGroupId !== null,
      openAiConfigured: config.openAiApiKeyConfigured,
      metricsEnabled: config.metrics.enabled
    });
    if (options.installSignalHandlers ?? true) {
      installShutdownHandlers(app, logger);
    }
    return app;
  });
}

function installShutdownHandlers(app: INestApplication, logger: StructuredLogger): void {
  const shutdown = (signal: NodeJS.Signals) => {
    void app
      .close()
      .then(() => {
        logger.info({ event: "app.stopped", signal });
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({
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

async function withTemporaryEnv<T>(
  env: NodeJS.ProcessEnv | undefined,
  callback: () => Promise<T>
): Promise<T> {
  if (env === undefined) {
    return callback();
  }
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }
      process.env[key] = value;
    }
  }
}
