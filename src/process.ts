import "reflect-metadata";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  RunDatabaseMigrationsUseCase,
  type DatabaseMigrationPort,
  type RunBirthdayReminderUseCasePort,
  type WhatsAppGroupMessenger
} from "./application/index.js";
import { AppModule } from "./app.module.js";
import {
  APP_CONFIG,
  DATABASE_MIGRATION_PORT,
  RUN_BIRTHDAY_REMINDER_USE_CASE,
  WHATSAPP_CLIENT,
  readErrorCode,
  readErrorMessage,
  type AppConfig
} from "./infrastructure/index.js";

export interface StartProcessOptions {
  env?: NodeJS.ProcessEnv;
  installSignalHandlers?: boolean;
  connectWhatsapp?: boolean;
}

export async function startProcess(
  options: StartProcessOptions = {}
): Promise<INestApplicationContext> {
  return withTemporaryEnv(options.env, async () => {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const config = app.get<AppConfig>(APP_CONFIG);
    const migrations = app.get<DatabaseMigrationPort>(DATABASE_MIGRATION_PORT);
    const reminder = app.get<RunBirthdayReminderUseCasePort>(RUN_BIRTHDAY_REMINDER_USE_CASE);
    const whatsappClient = app.get<WhatsAppGroupMessenger>(WHATSAPP_CLIENT);
    await new RunDatabaseMigrationsUseCase(migrations).execute();
    registerReconnectRecovery(whatsappClient, reminder);
    if (options.connectWhatsapp ?? true) {
      await whatsappClient.connect();
      await reminder.execute({
        trigger: "startup",
        now: new Date()
      });
    }
    console.info(
      JSON.stringify({
        event: "app.started",
        appName: config.appName,
        status: "ready",
        timezone: config.timezone,
        dailyCheckTime: config.dailyCheckTime,
        databaseConfigured: config.databasePath.length > 0,
        whatsappAuthConfigured: config.whatsappAuthDir.length > 0,
        whatsappGroupConfigured: config.whatsappGroupId !== null,
        openAiConfigured: config.openAiApiKeyConfigured
      })
    );
    if (options.installSignalHandlers ?? true) {
      installShutdownHandlers(app);
    }
    return app;
  });
}

interface ReadyAwareWhatsAppGroupMessenger extends WhatsAppGroupMessenger {
  onReady?(handler: () => Promise<void>): void;
}

function registerReconnectRecovery(
  whatsappClient: WhatsAppGroupMessenger,
  reminder: RunBirthdayReminderUseCasePort
): void {
  const readyAwareClient = whatsappClient as ReadyAwareWhatsAppGroupMessenger;
  readyAwareClient.onReady?.(async () => {
    await reminder.execute({
      trigger: "whatsapp-reconnect",
      now: new Date()
    });
  });
}

function installShutdownHandlers(app: INestApplicationContext): void {
  const shutdown = (signal: NodeJS.Signals) => {
    void app
      .close()
      .then(() => {
        console.info(JSON.stringify({ event: "app.stopped", signal }));
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            event: "app.stop_failed",
            signal,
            errorCode: readErrorCode(error),
            errorMessage: readErrorMessage(error)
          })
        );
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
