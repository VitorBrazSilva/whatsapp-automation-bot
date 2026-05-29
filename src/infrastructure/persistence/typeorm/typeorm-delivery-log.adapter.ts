import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  type DeliveryLogPort,
  type DeliveryLookup,
  type PriorMessagesLookup,
  type RecordedDelivery as ApplicationRecordedDelivery,
  type RecordDeliveryInput as ApplicationRecordDeliveryInput
} from "../../../application/index.js";
import {
  DuplicateMessageDeliveryError,
  type DeliveryLog,
  type RecordDeliveryInput,
  type RecordedDelivery
} from "../../../automation/automation-contracts.js";
import { MessageDeliveryEntity } from "./entities/index.js";
import { messageDeliveryEntityToRecordedDelivery } from "./mappers/index.js";

@Injectable()
export class TypeOrmDeliveryLogService implements DeliveryLog, DeliveryLogPort {
  constructor(
    @InjectRepository(MessageDeliveryEntity)
    private readonly deliveries: Repository<MessageDeliveryEntity>
  ) {}

  async hasSent(input: DeliveryLookup): Promise<boolean>;
  async hasSent(automationKey: string, dedupeKey: string, targetJid: string): Promise<boolean>;
  async hasSent(
    inputOrAutomationKey: DeliveryLookup | string,
    dedupeKey?: string,
    targetJid?: string
  ): Promise<boolean> {
    const lookup =
      typeof inputOrAutomationKey === "string"
        ? {
            automationKey: inputOrAutomationKey,
            dedupeKey: readRequiredValue(dedupeKey, "dedupeKey"),
            targetJid: readRequiredValue(targetJid, "targetJid")
          }
        : inputOrAutomationKey;
    const count = await this.deliveries.countBy({
      automationKey: lookup.automationKey,
      dedupeKey: lookup.dedupeKey,
      targetJid: lookup.targetJid,
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
    return this.findPriorMessages({ automationKey, subjectRef, targetJid, limit });
  }

  async findPriorMessages(input: PriorMessagesLookup): Promise<string[]> {
    const rows = await this.deliveries.find({
      where: {
        automationKey: input.automationKey,
        subjectRef: input.subjectRef,
        targetJid: input.targetJid,
        status: "sent"
      },
      order: {
        createdAt: "DESC"
      },
      take: input.limit
    });
    return rows.map((row) => row.messageText);
  }

  async record(input: ApplicationRecordDeliveryInput): Promise<ApplicationRecordedDelivery>;
  async record(input: RecordDeliveryInput): Promise<RecordedDelivery>;
  async record(
    input: ApplicationRecordDeliveryInput | RecordDeliveryInput
  ): Promise<ApplicationRecordedDelivery | RecordedDelivery> {
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
      return messageDeliveryEntityToRecordedDelivery(saved);
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

function readRequiredValue(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
