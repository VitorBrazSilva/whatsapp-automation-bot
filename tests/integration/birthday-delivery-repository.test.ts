import { describe, expect, it } from "vitest";
import { DataSource, type DataSourceOptions } from "typeorm";
import { createTypeOrmOptions } from "../../src/database/index.js";
import {
  BirthdayDeliveryEntity,
  DuplicateBirthdayDeliveryError,
  loadAppConfig,
  TypeOrmBirthdayDeliveryRepository
} from "../../src/infrastructure/index.js";

describe("TypeOrmBirthdayDeliveryRepository", () => {
  it("records sent deliveries, finds recent messages and enforces sent idempotency", async () => {
    const dataSource = await createMigratedDataSource();
    try {
      const repository = new TypeOrmBirthdayDeliveryRepository(
        dataSource.getRepository(BirthdayDeliveryEntity)
      );
      const key = {
        personId: "person-1",
        groupJid: "family@g.us",
        birthdayYear: 2026
      };

      await repository.record({
        key,
        messageText: "Parabens, Ana!",
        status: "sent",
        provider: "openai",
        model: "gpt-4.1-mini",
        providerMessageId: "provider-1",
        fallbackReason: null,
        errorCode: null,
        errorMessage: null
      });

      await expect(repository.hasSent(key)).resolves.toBe(true);
      await expect(repository.findRecentMessages("person-1", "family@g.us", 5)).resolves.toEqual([
        "Parabens, Ana!"
      ]);
      await expect(
        repository.record({
          key,
          messageText: "Mensagem repetida",
          status: "sent",
          provider: "openai",
          model: "gpt-4.1-mini",
          providerMessageId: "provider-2",
          fallbackReason: null,
          errorCode: null,
          errorMessage: null
        })
      ).rejects.toBeInstanceOf(DuplicateBirthdayDeliveryError);
      await repository.record({
        key,
        messageText: "Skipped because a successful delivery already exists.",
        status: "skipped",
        provider: null,
        model: null,
        providerMessageId: null,
        fallbackReason: null,
        errorCode: "DUPLICATE_SUCCESSFUL_DELIVERY",
        errorMessage: null
      });
    } finally {
      await dataSource.destroy();
    }
  });

  it("backfills birthday deliveries from legacy delivery attempts", async () => {
    const dataSource = new DataSource(
      createTypeOrmOptions(
        loadAppConfig({
          NODE_ENV: "test",
          DATABASE_PATH: ":memory:",
          WHATSAPP_GROUP_ID: "family@g.us"
        })
      ) as DataSourceOptions
    );
    await dataSource.initialize();
    try {
      await createLegacyBirthdayTables(dataSource);
      await dataSource.runMigrations();

      const rows = await dataSource.query("SELECT * FROM birthday_deliveries");
      const indexes = await dataSource.query("PRAGMA index_list('birthday_deliveries')");

      expect(rows).toMatchObject([
        {
          id: "delivery-1",
          person_id: "person-1",
          group_jid: "family@g.us",
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

async function createLegacyBirthdayTables(dataSource: DataSource): Promise<void> {
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
      'family@g.us',
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
