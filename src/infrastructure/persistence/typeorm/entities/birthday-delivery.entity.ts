import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type BirthdayDeliveryEntityStatus = "sent" | "failed" | "skipped";

@Entity("birthday_deliveries")
@Index("idx_birthday_deliveries_lookup", ["personId", "groupJid", "birthdayYear", "status"])
@Index("idx_birthday_deliveries_recent", ["personId", "groupJid", "createdAt"])
export class BirthdayDeliveryEntity {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ name: "person_id", type: "varchar" })
  personId!: string;

  @Column({ name: "group_jid", type: "varchar" })
  groupJid!: string;

  @Column({ name: "birthday_year", type: "integer" })
  birthdayYear!: number;

  @Column({ name: "message_text", type: "text" })
  messageText!: string;

  @Column({ type: "varchar" })
  status!: BirthdayDeliveryEntityStatus;

  @Column({ type: "varchar", nullable: true })
  provider!: string | null;

  @Column({ type: "varchar", nullable: true })
  model!: string | null;

  @Column({ name: "provider_message_id", type: "varchar", nullable: true })
  providerMessageId!: string | null;

  @Column({ name: "fallback_reason", type: "varchar", nullable: true })
  fallbackReason!: string | null;

  @Column({ name: "error_code", type: "varchar", nullable: true })
  errorCode!: string | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}
