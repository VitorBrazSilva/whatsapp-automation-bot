import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("people")
@Index("idx_people_active_birth_month_day", ["active", "birthDate"])
export class PersonEntity {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", nullable: true })
  nickname!: string | null;

  @Column({ name: "birth_date", type: "varchar" })
  birthDate!: string;

  @Column({ type: "varchar", nullable: true })
  relationship!: string | null;

  @Column({ type: "varchar", nullable: true })
  profession!: string | null;

  @Column({ type: "varchar", nullable: true })
  hobbies!: string | null;

  @Column({ type: "varchar", nullable: true })
  traits!: string | null;

  @Column({ name: "message_style", type: "varchar", nullable: true })
  messageStyle!: string | null;

  @Column({ type: "varchar", nullable: true })
  notes!: string | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}
