import type { AutomationTrigger } from "../database/index.js";

export const AUTOMATION_RUNNER = Symbol("AUTOMATION_RUNNER");
export const DELIVERY_LOG = Symbol("DELIVERY_LOG");

export interface AutomationRunInput {
  runId: string;
  automationKey: string;
  trigger: AutomationTrigger;
  now: Date;
}

export interface AutomationRunResult {
  itemsMatched: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
}

export interface AutomationHandler {
  key: string;
  run(input: AutomationRunInput): Promise<AutomationRunResult>;
}

export interface AutomationRunner {
  run(key: string, trigger: AutomationTrigger, now: Date): Promise<AutomationRunResult>;
}

export interface RecordDeliveryInput {
  automationRunId: string | null;
  automationKey: string;
  targetJid: string;
  dedupeKey: string;
  subjectRef: string | null;
  messageText: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface RecordedDelivery {
  id: string;
  createdAt: Date;
}

export interface DeliveryLog {
  hasSent(automationKey: string, dedupeKey: string, targetJid: string): Promise<boolean>;
  findSuccessfulMessages(
    automationKey: string,
    subjectRef: string,
    targetJid: string,
    limit: number
  ): Promise<string[]>;
  record(input: RecordDeliveryInput): Promise<RecordedDelivery>;
}

export class DuplicateMessageDeliveryError extends Error {
  constructor(dedupeKey: string, targetJid: string) {
    super(`Sent delivery already exists for ${dedupeKey} and ${targetJid}.`);
    this.name = "DuplicateMessageDeliveryError";
  }
}
