import { describe, expect, it } from "vitest";
import { DataSource, type DataSourceOptions } from "typeorm";
import { DuplicateMessageDeliveryError } from "../../src/automation/index.js";
import { createTypeOrmOptions } from "../../src/database/index.js";
import {
  loadAppConfig,
  MessageDeliveryEntity,
  TypeOrmDeliveryLogService
} from "../../src/infrastructure/index.js";

describe("TypeORM migrations", () => {
  it("creates the multi-target schema and migrates legacy birthday data", async () => {
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

      const runs = await dataSource.query("SELECT * FROM automation_runs");
      const deliveries = await dataSource.query("SELECT * FROM message_deliveries");
      const indexes = await dataSource.query("PRAGMA index_list('message_deliveries')");

      expect(runs).toMatchObject([
        {
          id: "check-1",
          automation_key: "birthdays.daily",
          trigger: "manual",
          target_date: "2026-05-26",
          status: "completed",
          items_matched: 1
        }
      ]);
      expect(deliveries).toMatchObject([
        {
          id: "delivery-1",
          automation_key: "birthdays.daily",
          target_jid: "family-group@g.us",
          dedupe_key: "birthday:person-1:2026",
          subject_ref: "person-1",
          status: "sent"
        }
      ]);
      expect(
        indexes.some(
          (index: { name: string }) => index.name === "idx_message_deliveries_unique_sent"
        )
      ).toBe(true);
    } finally {
      await dataSource.destroy();
    }
  });

  it("keeps sent delivery idempotency in the TypeORM delivery adapter", async () => {
    const dataSource = await createMigratedDataSource();
    try {
      const deliveryLog = new TypeOrmDeliveryLogService(
        dataSource.getRepository(MessageDeliveryEntity)
      );
      const input = {
        automationRunId: null,
        automationKey: "birthdays.daily",
        targetJid: "family-group@g.us",
        dedupeKey: "birthday:person-1:2026",
        subjectRef: "person-1",
        messageText: "Parabens, Ana!",
        status: "sent" as const,
        providerMessageId: "provider-1",
        errorCode: null,
        errorMessage: null
      };

      await deliveryLog.record(input);
      await expect(
        deliveryLog.record({
          ...input,
          providerMessageId: "provider-2"
        })
      ).rejects.toBeInstanceOf(DuplicateMessageDeliveryError);
      await deliveryLog.record({
        ...input,
        status: "skipped",
        providerMessageId: null,
        errorCode: "DUPLICATE_SUCCESSFUL_DELIVERY"
      });

      expect(
        await deliveryLog.hasSent({
          automationKey: input.automationKey,
          dedupeKey: input.dedupeKey,
          targetJid: input.targetJid
        })
      ).toBe(true);
    } finally {
      await dataSource.destroy();
    }
  });
});

async function createMigratedDataSource(): Promise<DataSource> {
  const dataSource = new DataSource(
    createTypeOrmOptions(
      loadAppConfig({
        NODE_ENV: "test",
        DATABASE_PATH: ":memory:"
      })
    ) as DataSourceOptions
  );
  await dataSource.initialize();
  await dataSource.runMigrations();
  return dataSource;
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
