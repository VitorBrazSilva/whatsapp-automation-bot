import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  BirthdayDeliveryRecord,
  BirthdayDeliveryRepository,
  RecordedBirthdayDelivery
} from "../../../application/index.js";
import type { BirthdayDeliveryKey } from "../../../domain/index.js";
import { BirthdayDeliveryEntity } from "./entities/index.js";

export class DuplicateBirthdayDeliveryError extends Error {
  readonly key: BirthdayDeliveryKey;

  constructor(key: BirthdayDeliveryKey) {
    super("A successful birthday delivery already exists for this person, group and year.");
    this.name = "DuplicateBirthdayDeliveryError";
    this.key = key;
  }
}

@Injectable()
export class TypeOrmBirthdayDeliveryRepository implements BirthdayDeliveryRepository {
  constructor(
    @InjectRepository(BirthdayDeliveryEntity)
    private readonly deliveries: Repository<BirthdayDeliveryEntity>
  ) {}

  async hasSent(input: BirthdayDeliveryKey): Promise<boolean> {
    const count = await this.deliveries.countBy({
      personId: input.personId,
      groupJid: input.groupJid,
      birthdayYear: input.birthdayYear,
      status: "sent"
    });
    return count > 0;
  }

  async findRecentMessages(personId: string, groupJid: string, limit: number): Promise<string[]> {
    const rows = await this.deliveries.find({
      where: {
        personId,
        groupJid,
        status: "sent"
      },
      order: {
        createdAt: "DESC"
      },
      take: limit
    });
    return rows.map((row) => row.messageText);
  }

  async record(input: BirthdayDeliveryRecord): Promise<RecordedBirthdayDelivery> {
    const entity = this.deliveries.create({
      id: randomUUID(),
      personId: input.key.personId,
      groupJid: input.key.groupJid,
      birthdayYear: input.key.birthdayYear,
      messageText: input.messageText,
      status: input.status,
      provider: input.provider,
      model: input.model,
      providerMessageId: input.providerMessageId,
      fallbackReason: input.fallbackReason,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      createdAt: new Date()
    });
    try {
      const saved = await this.deliveries.save(entity);
      return {
        id: saved.id,
        createdAt: saved.createdAt
      };
    } catch (error) {
      if (input.status === "sent" && isUniqueConstraintError(error)) {
        throw new DuplicateBirthdayDeliveryError(input.key);
      }
      throw error;
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
