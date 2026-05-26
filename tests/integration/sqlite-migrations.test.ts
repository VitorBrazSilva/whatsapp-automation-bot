import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openSqliteDatabase, runMigrations } from "../../src/database/index.js";

describe("SQLite migrations", () => {
  it("applies schema migrations idempotently", async () => {
    const database = await openSqliteDatabase({ path: ":memory:" });

    const firstRun = await runMigrations(database);
    const secondRun = await runMigrations(database);

    expect(firstRun.applied.map((migration) => migration.version)).toEqual([1]);
    expect(secondRun.applied).toEqual([]);
    expect(readTableNames(database)).toEqual([
      "birthday_checks",
      "delivery_attempts",
      "people",
      "schema_migrations"
    ]);
    expect(database.get("SELECT version, name FROM schema_migrations WHERE version = 1")).toEqual({
      version: 1,
      name: "initial_schema"
    });

    database.close();
  });

  it("supports a temporary file-backed database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "birthday-bot-"));
    const databasePath = join(directory, "test.sqlite");

    try {
      const database = await openSqliteDatabase({ path: databasePath });
      await runMigrations(database);
      await database.save();
      database.close();

      const reopenedDatabase = await openSqliteDatabase({ path: databasePath });
      expect(reopenedDatabase.get("SELECT COUNT(*) AS total FROM schema_migrations")).toEqual({
        total: 1
      });
      reopenedDatabase.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function readTableNames(database: Awaited<ReturnType<typeof openSqliteDatabase>>): string[] {
  return database
    .all(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name ASC
      `
    )
    .map((row) => String(row.name));
}
