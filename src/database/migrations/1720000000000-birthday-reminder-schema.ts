import type { MigrationInterface, QueryRunner } from "typeorm";

export class BirthdayReminderSchema1720000000000 implements MigrationInterface {
  name = "BirthdayReminderSchema1720000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS birthday_deliveries (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL,
        group_jid TEXT NOT NULL,
        birthday_year INTEGER NOT NULL CHECK (birthday_year >= 1900),
        message_text TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
        provider TEXT,
        model TEXT,
        provider_message_id TEXT,
        fallback_reason TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_birthday_deliveries_lookup
      ON birthday_deliveries (person_id, group_jid, birthday_year, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_birthday_deliveries_recent
      ON birthday_deliveries (person_id, group_jid, created_at)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_birthday_deliveries_unique_sent
      ON birthday_deliveries (person_id, group_jid, birthday_year)
      WHERE status = 'sent'
    `);
    await this.backfillFromMessageDeliveries(queryRunner);
    await this.backfillFromDeliveryAttempts(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS birthday_deliveries");
  }

  private async backfillFromMessageDeliveries(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("message_deliveries"))) {
      return;
    }
    await queryRunner.query(`
      INSERT OR IGNORE INTO birthday_deliveries (
        id,
        person_id,
        group_jid,
        birthday_year,
        message_text,
        status,
        provider,
        model,
        provider_message_id,
        fallback_reason,
        error_code,
        error_message,
        created_at
      )
      SELECT
        id,
        subject_ref,
        target_jid,
        CAST(substr(dedupe_key, length('birthday:' || subject_ref || ':') + 1) AS INTEGER),
        message_text,
        status,
        CASE WHEN status = 'sent' THEN 'legacy' ELSE NULL END,
        NULL,
        provider_message_id,
        NULL,
        error_code,
        error_message,
        created_at
      FROM message_deliveries
      WHERE subject_ref IS NOT NULL
        AND dedupe_key LIKE 'birthday:%'
        AND status IN ('sent', 'failed', 'skipped')
    `);
  }

  private async backfillFromDeliveryAttempts(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("delivery_attempts"))) {
      return;
    }
    await queryRunner.query(`
      INSERT OR IGNORE INTO birthday_deliveries (
        id,
        person_id,
        group_jid,
        birthday_year,
        message_text,
        status,
        provider,
        model,
        provider_message_id,
        fallback_reason,
        error_code,
        error_message,
        created_at
      )
      SELECT
        id,
        person_id,
        group_id,
        birthday_year,
        message_text,
        status,
        CASE WHEN status = 'sent' THEN 'legacy' ELSE NULL END,
        NULL,
        provider_message_id,
        NULL,
        error_code,
        error_message,
        created_at
      FROM delivery_attempts
      WHERE status IN ('sent', 'failed', 'skipped')
    `);
  }
}
