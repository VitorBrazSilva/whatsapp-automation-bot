import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type MessageDeliveryStatus = "sent" | "failed" | "skipped";

@Entity("message_deliveries")
@Index("idx_message_deliveries_run_id", ["automationRunId"])
@Index("idx_message_deliveries_lookup", ["automationKey", "dedupeKey", "targetJid"])
export class MessageDeliveryEntity {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ name: "automation_run_id", type: "varchar", nullable: true })
  automationRunId!: string | null;

  @Column({ name: "automation_key", type: "varchar" })
  automationKey!: string;

  @Column({ name: "target_jid", type: "varchar" })
  targetJid!: string;

  @Column({ name: "dedupe_key", type: "varchar" })
  dedupeKey!: string;

  @Column({ name: "subject_ref", type: "varchar", nullable: true })
  subjectRef!: string | null;

  @Column({ name: "message_text", type: "text" })
  messageText!: string;

  @Column({ type: "varchar" })
  status!: MessageDeliveryStatus;

  @Column({ name: "provider_message_id", type: "varchar", nullable: true })
  providerMessageId!: string | null;

  @Column({ name: "error_code", type: "varchar", nullable: true })
  errorCode!: string | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}
