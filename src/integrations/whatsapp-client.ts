export interface SendResult {
  providerMessageId: string | null;
  sentAt: Date;
}

export interface WhatsAppClient {
  connect(): Promise<void>;
  sendGroupMessage(groupId: string, text: string): Promise<SendResult>;
  onReady(handler: () => Promise<void>): void;
}
