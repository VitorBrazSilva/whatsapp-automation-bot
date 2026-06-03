import type {
  BirthdayMessageGenerator as MessageGenerator,
  GeneratedBirthdayMessage
} from "../../application/index.js";
import type { BirthdayMessageInput } from "../../domain/index.js";

export type { BirthdayMessageInput, GeneratedBirthdayMessage, MessageGenerator };

export interface OpenAiFallbackDetails {
  status: number | null;
  statusText: string | null;
  requestId: string | null;
}

export interface JsonObject {
  [key: string]: unknown;
}
