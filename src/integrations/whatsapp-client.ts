export interface SendResult {
  providerMessageId: string | null;
  sentAt: Date;
}

export interface WhatsAppGroup {
  id: string;
  subject: string;
  participantCount: number;
}

export interface WhatsAppClient {
  connect(): Promise<void>;
  sendGroupMessage(groupId: string, text: string): Promise<SendResult>;
  onReady(handler: () => Promise<void>): void;
}

export interface WhatsAppGroupLister {
  listGroups(): Promise<WhatsAppGroup[]>;
}

export class WhatsAppSendError extends Error {
  readonly code: string;
  readonly cause: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "WhatsAppSendError";
    this.code = code;
    this.cause = cause;
  }
}
