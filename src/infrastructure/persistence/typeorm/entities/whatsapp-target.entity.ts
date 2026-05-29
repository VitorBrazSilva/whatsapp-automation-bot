import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type WhatsappTargetType = "group";

@Entity("whatsapp_targets")
@Index("idx_whatsapp_targets_jid", ["jid"], { unique: true })
export class WhatsappTargetEntity {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar" })
  jid!: string;

  @Column({ name: "display_name", type: "varchar" })
  displayName!: string;

  @Column({ type: "varchar" })
  type!: WhatsappTargetType;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}
