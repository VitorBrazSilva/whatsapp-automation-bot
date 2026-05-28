import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialWhatsappAutomationSchema1710000000000 implements MigrationInterface {
  name = "InitialWhatsappAutomationSchema1710000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        nickname TEXT,
        birth_date TEXT NOT NULL CHECK (birth_date GLOB '????-??-??'),
        relationship TEXT,
        profession TEXT,
        hobbies TEXT,
        traits TEXT,
        message_style TEXT,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_people_active_birth_month_day
      ON people (active, substr(birth_date, 6, 2), substr(birth_date, 9, 2))
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_targets (
        id TEXT PRIMARY KEY,
        jid TEXT NOT NULL,
        display_name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('group')),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_targets_jid
      ON whatsapp_targets (jid)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS automation_targets (
        id TEXT PRIMARY KEY,
        automation_key TEXT NOT NULL,
        target_id TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        settings_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (target_id) REFERENCES whatsapp_targets(id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_targets_unique
      ON automation_targets (automation_key, target_id)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS automation_runs (
        id TEXT PRIMARY KEY,
        automation_key TEXT NOT NULL,
        trigger TEXT NOT NULL CHECK (
          trigger IN ('scheduled', 'startup', 'whatsapp-reconnect', 'manual')
        ),
        target_date TEXT NOT NULL CHECK (target_date GLOB '????-??-??'),
        timezone TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
        items_matched INTEGER NOT NULL DEFAULT 0 CHECK (items_matched >= 0),
        deliveries_sent INTEGER NOT NULL DEFAULT 0 CHECK (deliveries_sent >= 0),
        duplicate_skips INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_skips >= 0),
        failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        error_message TEXT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_automation_runs_key_target_date
      ON automation_runs (automation_key, target_date)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS message_deliveries (
        id TEXT PRIMARY KEY,
        automation_run_id TEXT,
        automation_key TEXT NOT NULL,
        target_jid TEXT NOT NULL,
        dedupe_key TEXT NOT NULL,
        subject_ref TEXT,
        message_text TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
        provider_message_id TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (automation_run_id) REFERENCES automation_runs(id) ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_message_deliveries_lookup
      ON message_deliveries (automation_key, dedupe_key, target_jid)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_message_deliveries_run_id
      ON message_deliveries (automation_run_id)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_message_deliveries_unique_sent
      ON message_deliveries (automation_key, dedupe_key, target_jid)
      WHERE status = 'sent'
    `);
    await this.migrateLegacyRuns(queryRunner);
    await this.migrateLegacyDeliveries(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS message_deliveries");
    await queryRunner.query("DROP TABLE IF EXISTS automation_runs");
    await queryRunner.query("DROP TABLE IF EXISTS automation_targets");
    await queryRunner.query("DROP TABLE IF EXISTS whatsapp_targets");
  }

  private async migrateLegacyRuns(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("birthday_checks"))) {
      return;
    }
    await queryRunner.query(`
      INSERT OR IGNORE INTO automation_runs (
        id,
        automation_key,
        trigger,
        target_date,
        timezone,
        status,
        items_matched,
        deliveries_sent,
        duplicate_skips,
        failures,
        started_at,
        finished_at,
        error_message
      )
      SELECT
        id,
        'birthdays.daily',
        trigger,
        check_date,
        timezone,
        status,
        birthdays_found,
        deliveries_sent,
        duplicate_skips,
        failures,
        started_at,
        finished_at,
        error_message
      FROM birthday_checks
    `);
  }

  private async migrateLegacyDeliveries(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("delivery_attempts"))) {
      return;
    }
    await queryRunner.query(`
      INSERT OR IGNORE INTO message_deliveries (
        id,
        automation_run_id,
        automation_key,
        target_jid,
        dedupe_key,
        subject_ref,
        message_text,
        status,
        provider_message_id,
        error_code,
        error_message,
        created_at
      )
      SELECT
        id,
        check_id,
        'birthdays.daily',
        group_id,
        'birthday:' || person_id || ':' || birthday_year,
        person_id,
        message_text,
        status,
        provider_message_id,
        error_code,
        error_message,
        created_at
      FROM delivery_attempts
    `);
  }
}
