import type {
  GeneratedMessage,
  MessageGeneratorPort as MessageGenerator
} from "../../application/index.js";
import type { BirthdayMessageInput } from "../../domain/index.js";

export type { BirthdayMessageInput, GeneratedMessage, MessageGenerator };

export interface OpenAiFallbackDetails {
  status: number | null;
  statusText: string | null;
  requestId: string | null;
}

export interface JsonObject {
  [key: string]: unknown;
}
