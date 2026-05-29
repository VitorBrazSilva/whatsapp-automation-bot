import type { BirthdayMessageInput } from "../../../domain/index.js";

export interface GeneratedMessage {
  message: string;
  provider: string;
  model: string | null;
  fallbackReason: string | null;
  fallbackDetails: {
    status: number | null;
    statusText: string | null;
    requestId: string | null;
  } | null;
}

export interface MessageGeneratorPort {
  generate(input: BirthdayMessageInput): Promise<GeneratedMessage>;
}
