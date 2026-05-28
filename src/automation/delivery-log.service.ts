import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MessageDeliveryEntity } from "../database/index.js";
import {
  DuplicateMessageDeliveryError,
  type DeliveryLog,
  type RecordDeliveryInput,
  type RecordedDelivery
} from "./automation-contracts.js";

@Injectable()
export class TypeOrmDeliveryLogService implements DeliveryLog {
  constructor(
    @InjectRepository(MessageDeliveryEntity)
    private readonly deliveries: Repository<MessageDeliveryEntity>
  ) {}

  async hasSent(automationKey: string, dedupeKey: string, targetJid: string): Promise<boolean> {
    const count = await this.deliveries.countBy({
      automationKey,
      dedupeKey,
      targetJid,
      status: "sent"
    });
    return count > 0;
  }

  async findSuccessfulMessages(
    automationKey: string,
    subjectRef: string,
    targetJid: string,
    limit: number
  ): Promise<string[]> {
    const rows = await this.deliveries.find({
      where: {
        automationKey,
        subjectRef,
        targetJid,
        status: "sent"
      },
      order: {
        createdAt: "DESC"
      },
      take: limit
    });
    return rows.map((row) => row.messageText);
  }

  async record(input: RecordDeliveryInput): Promise<RecordedDelivery> {
    const entity = this.deliveries.create({
      id: randomUUID(),
      automationRunId: input.automationRunId,
      automationKey: input.automationKey,
      targetJid: input.targetJid,
      dedupeKey: input.dedupeKey,
      subjectRef: input.subjectRef,
      messageText: input.messageText,
      status: input.status,
      providerMessageId: input.providerMessageId,
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
        throw new DuplicateMessageDeliveryError(input.dedupeKey, input.targetJid);
      }
      throw error;
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
