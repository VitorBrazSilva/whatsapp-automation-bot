import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type AutomationRunStatus = "started" | "completed" | "failed";
export type AutomationTrigger = "scheduled" | "startup" | "whatsapp-reconnect" | "manual";

@Entity("automation_runs")
@Index("idx_automation_runs_key_target_date", ["automationKey", "targetDate"])
export class AutomationRunEntity {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ name: "automation_key", type: "varchar" })
  automationKey!: string;

  @Column({ type: "varchar" })
  trigger!: AutomationTrigger;

  @Column({ name: "target_date", type: "varchar" })
  targetDate!: string;

  @Column({ type: "varchar" })
  timezone!: string;

  @Column({ type: "varchar" })
  status!: AutomationRunStatus;

  @Column({ name: "items_matched", type: "integer", default: 0 })
  itemsMatched!: number;

  @Column({ name: "deliveries_sent", type: "integer", default: 0 })
  deliveriesSent!: number;

  @Column({ name: "duplicate_skips", type: "integer", default: 0 })
  duplicateSkips!: number;

  @Column({ type: "integer", default: 0 })
  failures!: number;

  @Column({ name: "started_at", type: "datetime" })
  startedAt!: Date;

  @Column({ name: "finished_at", type: "datetime", nullable: true })
  finishedAt!: Date | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;
}
