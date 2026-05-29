import "reflect-metadata";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  AddGroupTargetUseCase,
  RunDatabaseMigrationsUseCase,
  type DatabaseMigrationPort,
  type TargetConfigurationPort
} from "../../application/index.js";
import { AppModule } from "../../app.module.js";
import { BIRTHDAY_AUTOMATION_KEY } from "../../domain/index.js";
import {
  APP_CONFIG,
  DATABASE_MIGRATION_PORT,
  TARGET_CONFIGURATION_PORT,
  type AppConfig
} from "../../infrastructure/index.js";

export interface CommandContextOptions {
  env?: NodeJS.ProcessEnv;
  runMigrations?: boolean;
  ensureLegacyTargets?: boolean;
}

export async function createCommandContext(
  options: CommandContextOptions = {}
): Promise<INestApplicationContext> {
  return withTemporaryEnv(createCommandEnv(options.env), async () => {
    const context = await NestFactory.createApplicationContext(AppModule, { logger: false });
    if (options.runMigrations ?? true) {
      await new RunDatabaseMigrationsUseCase(
        context.get<DatabaseMigrationPort>(DATABASE_MIGRATION_PORT)
      ).execute();
    }
    if (options.ensureLegacyTargets ?? true) {
      await ensureLegacyBirthdayTarget(context);
    }
    return context;
  });
}

async function ensureLegacyBirthdayTarget(context: INestApplicationContext): Promise<void> {
  const config = context.get<AppConfig>(APP_CONFIG);
  if (config.whatsappGroupId === null) {
    return;
  }
  await new AddGroupTargetUseCase(
    context.get<TargetConfigurationPort>(TARGET_CONFIGURATION_PORT)
  ).execute({
    automationKey: BIRTHDAY_AUTOMATION_KEY,
    jid: config.whatsappGroupId
  });
}

function createCommandEnv(env: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  return {
    ...env,
    SCHEDULER_ENABLED: "false"
  };
}

async function withTemporaryEnv<T>(env: NodeJS.ProcessEnv, callback: () => Promise<T>): Promise<T> {
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
