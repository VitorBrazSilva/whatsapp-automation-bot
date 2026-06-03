import type { MigrationInterface, QueryRunner } from "typeorm";

export class DropLegacyAutomationSchema1730000000000 implements MigrationInterface {
  name = "DropLegacyAutomationSchema1730000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS automation_targets");
    await queryRunner.query("DROP TABLE IF EXISTS whatsapp_targets");
    await queryRunner.query("DROP TABLE IF EXISTS message_deliveries");
    await queryRunner.query("DROP TABLE IF EXISTS automation_runs");
    await queryRunner.query("DROP TABLE IF EXISTS birthday_checks");
    await queryRunner.query("DROP TABLE IF EXISTS delivery_attempts");
  }

  async down(): Promise<void> {
    return undefined;
  }
}
