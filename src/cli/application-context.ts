import "reflect-metadata";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.js";
import { DatabaseMigrationService } from "../database/index.js";
import { TargetsService } from "../targets/index.js";

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
      await context.get(DatabaseMigrationService).runMigrations();
    }
    if (options.ensureLegacyTargets ?? true) {
      await context.get(TargetsService).ensureLegacyBirthdayTarget();
    }
    return context;
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
