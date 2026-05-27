import { loadAppConfig } from "../config/index.js";
import { openSqliteDatabase, runMigrations, type SqliteDatabase } from "../database/index.js";

export interface DbMigrateCommandOptions {
  env?: NodeJS.ProcessEnv;
  database?: SqliteDatabase;
  migrationsDirectory?: string;
  stdout?: (line: string) => void;
}

export interface DbMigrateCommandResult {
  appliedCount: number;
}

export async function runDbMigrateCommand(
  options: DbMigrateCommandOptions = {}
): Promise<DbMigrateCommandResult> {
  const stdout = options.stdout ?? console.log;
  const config = loadAppConfig(options.env);
  const database = options.database ?? (await openSqliteDatabase({ path: config.databasePath }));
  try {
    const result = await runMigrations(database, options.migrationsDirectory);
    stdout(
      JSON.stringify({
        event: "database.migrations.completed",
        appliedCount: result.applied.length
      })
    );
    return { appliedCount: result.applied.length };
  } finally {
    await database.save();
    if (options.database === undefined) {
      database.close();
    }
  }
}
