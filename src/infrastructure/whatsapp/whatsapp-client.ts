import type { SendResult, WhatsAppGroup, WhatsAppGroupMessenger } from "../../application/index.js";

export type { SendResult, WhatsAppGroup };

export interface WhatsAppClient extends WhatsAppGroupMessenger {
  onReady(handler: () => Promise<void>): void;
}

export type WhatsAppGroupLister = Pick<WhatsAppGroupMessenger, "listGroups">;

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
