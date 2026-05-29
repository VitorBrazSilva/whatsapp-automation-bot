import type {
  SendResult,
  WhatsAppClientPort,
  WhatsAppGroup,
  WhatsAppGroupListerPort
} from "../../application/index.js";

export type { SendResult, WhatsAppGroup };

export interface WhatsAppClient extends WhatsAppClientPort {
  connect(): Promise<void>;
}

export type WhatsAppGroupLister = WhatsAppGroupListerPort;

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
