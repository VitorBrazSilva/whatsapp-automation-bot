import { describe, expect, it } from "vitest";
import { DataSource, type DataSourceOptions } from "typeorm";
import { createTypeOrmOptions } from "../../src/database/index.js";
import { loadAppConfig } from "../../src/infrastructure/index.js";

describe("TypeORM migrations", () => {
  it("creates the simplified birthday schema and migrates legacy birthday data", async () => {
    const dataSource = new DataSource(
      createTypeOrmOptions(
        loadAppConfig({
          NODE_ENV: "test",
          DATABASE_PATH: ":memory:",
          WHATSAPP_GROUP_ID: "family-group@g.us"
        })
      ) as DataSourceOptions
    );
    await dataSource.initialize();
    try {
      await createLegacySchema(dataSource);
      await dataSource.runMigrations();

      const deliveries = await dataSource.query("SELECT * FROM birthday_deliveries");
      const indexes = await dataSource.query("PRAGMA index_list('birthday_deliveries')");
      const legacyTables = await listLegacyTables(dataSource);

      expect(deliveries).toMatchObject([
        {
          id: "delivery-1",
          person_id: "person-1",
          group_jid: "family-group@g.us",
          birthday_year: 2026,
          message_text: "Parabens, Ana!",
          status: "sent",
          provider: "legacy"
        }
      ]);
      expect(
        indexes.some(
          (index: { name: string }) => index.name === "idx_birthday_deliveries_unique_sent"
        )
      ).toBe(true);
      expect(legacyTables).toEqual([]);
    } finally {
      await dataSource.destroy();
    }
  });
});

async function listLegacyTables(dataSource: DataSource): Promise<string[]> {
  const rows = (await dataSource.query(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
      AND name IN (
        'automation_runs',
        'automation_targets',
        'whatsapp_targets',
        'message_deliveries',
        'birthday_checks',
        'delivery_attempts'
      )
    ORDER BY name
  `)) as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

async function createLegacySchema(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE TABLE birthday_checks (
      id TEXT PRIMARY KEY,
      check_date TEXT NOT NULL,
      timezone TEXT NOT NULL,
      trigger TEXT NOT NULL,
      status TEXT NOT NULL,
      birthdays_found INTEGER NOT NULL,
      deliveries_sent INTEGER NOT NULL,
      duplicate_skips INTEGER NOT NULL,
      failures INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      error_message TEXT
    )
  `);
  await dataSource.query(`
    INSERT INTO birthday_checks (
      id,
      check_date,
      timezone,
      trigger,
      status,
      birthdays_found,
      deliveries_sent,
      duplicate_skips,
      failures,
      started_at,
      finished_at,
      error_message
    )
    VALUES (
      'check-1',
      '2026-05-26',
      'America/Sao_Paulo',
      'manual',
      'completed',
      1,
      1,
      0,
      0,
      '2026-05-26T12:00:00.000Z',
      '2026-05-26T12:00:01.000Z',
      NULL
    )
  `);
  await dataSource.query(`
    CREATE TABLE delivery_attempts (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      birthday_year INTEGER NOT NULL,
      check_id TEXT NOT NULL,
      message_text TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_message_id TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await dataSource.query(`
    INSERT INTO delivery_attempts (
      id,
      person_id,
      group_id,
      birthday_year,
      check_id,
      message_text,
      status,
      provider_message_id,
      error_code,
      error_message,
      created_at
    )
    VALUES (
      'delivery-1',
      'person-1',
      'family-group@g.us',
      2026,
      'check-1',
      'Parabens, Ana!',
      'sent',
      'provider-1',
      NULL,
      NULL,
      '2026-05-26T12:00:01.000Z'
    )
  `);
}
