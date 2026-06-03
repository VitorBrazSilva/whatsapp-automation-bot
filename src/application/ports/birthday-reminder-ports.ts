import type { BirthdayDeliveryKey, BirthdayMessageInput, Person } from "../../domain/index.js";

export type BirthdayTrigger = "scheduled" | "startup" | "whatsapp-reconnect" | "manual";

export interface RunBirthdayReminderInput {
  now: Date;
  trigger: BirthdayTrigger;
}

export interface BirthdayReminderResult {
  peopleMatched: number;
  sent: number;
  skipped: number;
  failed: number;
}

export interface RunBirthdayReminderUseCasePort {
  execute(input: RunBirthdayReminderInput): Promise<BirthdayReminderResult>;
}

export type BirthdayDeliveryStatus = "sent" | "failed" | "skipped";

export interface PersonRepository {
  findActiveByBirthday(month: number, day: number): Promise<Person[]>;
}

export interface BirthdayDeliveryRecord {
  key: BirthdayDeliveryKey;
  messageText: string;
  status: BirthdayDeliveryStatus;
  provider: string | null;
  model: string | null;
  providerMessageId: string | null;
  fallbackReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface RecordedBirthdayDelivery {
  id: string;
  createdAt: Date;
}

export interface BirthdayDeliveryRepository {
  hasSent(input: BirthdayDeliveryKey): Promise<boolean>;
  findRecentMessages(personId: string, groupJid: string, limit: number): Promise<string[]>;
  record(input: BirthdayDeliveryRecord): Promise<RecordedBirthdayDelivery>;
}

export interface GeneratedBirthdayMessage {
  message: string;
  provider: string;
  model: string | null;
  fallbackReason: string | null;
}

export interface BirthdayMessageGenerator {
  generate(input: BirthdayMessageInput): Promise<GeneratedBirthdayMessage>;
}

export interface SendResult {
  providerMessageId: string | null;
  sentAt: Date;
}

export interface WhatsAppGroup {
  id: string;
  subject: string;
  participantCount: number | null;
}

export interface WhatsAppGroupMessenger {
  connect(): Promise<void>;
  sendGroupMessage(groupJid: string, text: string): Promise<SendResult>;
  listGroups(): Promise<WhatsAppGroup[]>;
  close(): Promise<void>;
}
