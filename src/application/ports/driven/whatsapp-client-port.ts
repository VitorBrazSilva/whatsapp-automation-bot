export interface SendResult {
  providerMessageId: string | null;
  sentAt: Date;
}

export interface WhatsAppGroup {
  id: string;
  subject: string;
  participantCount: number | null;
}

export interface WhatsAppMessageSenderPort {
  sendGroupMessage(targetJid: string, text: string): Promise<SendResult>;
  onReady(handler: () => Promise<void>): void;
}

export interface WhatsAppGroupListerPort {
  listGroups(): Promise<WhatsAppGroup[]>;
}

export interface WhatsAppClientPort extends WhatsAppMessageSenderPort, WhatsAppGroupListerPort {}
