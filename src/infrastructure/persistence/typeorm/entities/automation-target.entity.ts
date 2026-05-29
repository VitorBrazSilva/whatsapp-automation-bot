import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("automation_targets")
@Index("idx_automation_targets_unique", ["automationKey", "targetId"], { unique: true })
export class AutomationTargetEntity {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ name: "automation_key", type: "varchar" })
  automationKey!: string;

  @Column({ name: "target_id", type: "varchar" })
  targetId!: string;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "settings_json", type: "text", nullable: true })
  settingsJson!: string | null;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}
