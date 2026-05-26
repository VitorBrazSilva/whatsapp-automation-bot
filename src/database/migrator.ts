import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SqliteDatabase } from "./sqlite-database.js";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export interface MigrationResult {
  applied: Migration[];
}

const MIGRATION_FILE_PATTERN = /^(\d+)_([a-z0-9_-]+)\.sql$/i;

export async function runMigrations(
  database: SqliteDatabase,
  migrationsDirectory = "migrations"
): Promise<MigrationResult> {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const migrations = await readMigrations(migrationsDirectory);
  const applied: Migration[] = [];

  for (const migration of migrations) {
    const alreadyApplied = database.get("SELECT version FROM schema_migrations WHERE version = ?", [
      migration.version
    ]);
    if (alreadyApplied !== null) {
      continue;
    }

    database.transaction(() => {
      database.raw.exec(migration.sql);
      database.raw.run("INSERT INTO schema_migrations (version, name) VALUES (?, ?)", [
        migration.version,
        migration.name
      ]);
    });
    applied.push(migration);
  }

  await database.save();
  return { applied };
}

async function readMigrations(migrationsDirectory: string): Promise<Migration[]> {
  const fileNames = await readdir(migrationsDirectory);
  const migrations = await Promise.all(
    fileNames
      .filter((fileName) => MIGRATION_FILE_PATTERN.test(fileName))
      .map(async (fileName) => {
        const match = MIGRATION_FILE_PATTERN.exec(fileName);
        if (match === null) {
          throw new Error(`Invalid migration filename: ${fileName}`);
        }
        return {
          version: Number(match[1]),
          name: match[2],
          sql: await readFile(join(migrationsDirectory, fileName), "utf8")
        };
      })
  );

  return migrations.sort((left, right) => left.version - right.version);
}
