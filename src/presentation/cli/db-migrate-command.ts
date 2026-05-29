import {
  RunDatabaseMigrationsUseCase,
  type DatabaseMigrationPort
} from "../../application/index.js";
import { DATABASE_MIGRATION_PORT } from "../../infrastructure/index.js";
import { createCommandContext } from "./application-context.js";

export interface DbMigrateCommandOptions {
  env?: NodeJS.ProcessEnv;
  stdout?: (line: string) => void;
}

export interface DbMigrateCommandResult {
  appliedCount: number;
}

export async function runDbMigrateCommand(
  options: DbMigrateCommandOptions = {}
): Promise<DbMigrateCommandResult> {
  const stdout = options.stdout ?? console.log;
  const context = await createCommandContext({
    env: options.env,
    runMigrations: false,
    ensureLegacyTargets: false
  });
  try {
    const applied = await new RunDatabaseMigrationsUseCase(
      context.get<DatabaseMigrationPort>(DATABASE_MIGRATION_PORT)
    ).execute();
    stdout(
      JSON.stringify({
        event: "database.migrations.completed",
        appliedCount: applied.length
      })
    );
    return { appliedCount: applied.length };
  } finally {
    await context.close();
  }
}
