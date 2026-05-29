export interface DeliveryLookup {
  automationKey: string;
  dedupeKey: string;
  targetJid: string;
}

export interface PriorMessagesLookup {
  automationKey: string;
  subjectRef: string;
  targetJid: string;
  limit: number;
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

export interface DeliveryLogPort {
  hasSent(input: DeliveryLookup): Promise<boolean>;
  findPriorMessages(input: PriorMessagesLookup): Promise<string[]>;
  record(input: RecordDeliveryInput): Promise<RecordedDelivery>;
}
