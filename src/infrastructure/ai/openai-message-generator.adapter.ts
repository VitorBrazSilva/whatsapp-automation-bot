import type {
  BirthdayMessageGenerator,
  GeneratedBirthdayMessage
} from "../../application/index.js";
import {
  DEFAULT_MAX_BIRTHDAY_MESSAGE_LENGTH,
  createFallbackBirthdayMessage,
  validateGeneratedBirthdayMessage,
  type BirthdayMessageInput
} from "../../domain/index.js";
import { buildOpenAiBirthdayMessageRequest } from "./openai-birthday-message-request.js";
import { readMessagePayload } from "./openai-birthday-message-response.js";
import { readFallbackReason } from "./openai-fallback.js";
import {
  FetchOpenAiResponsesClient,
  type OpenAiResponsesClient
} from "./openai-responses-client.js";

export interface OpenAiMessageGeneratorOptions {
  apiKey?: string | null;
  model: string;
  timeoutMs: number;
  client?: OpenAiResponsesClient;
  maxMessageLength?: number;
}

export class OpenAiMessageGeneratorAdapter implements BirthdayMessageGenerator {
  private readonly client: OpenAiResponsesClient | null;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxMessageLength: number;

  constructor(options: OpenAiMessageGeneratorOptions) {
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
    this.maxMessageLength = options.maxMessageLength ?? DEFAULT_MAX_BIRTHDAY_MESSAGE_LENGTH;
    this.client =
      options.client ??
      (options.apiKey === undefined || options.apiKey === null
        ? null
        : new FetchOpenAiResponsesClient(options.apiKey));
  }

  async generate(input: BirthdayMessageInput): Promise<GeneratedBirthdayMessage> {
    if (this.client === null) {
      return this.createFallbackMessage(input, "OPENAI_API_KEY_NOT_CONFIGURED");
    }

    const controller = new AbortController();
    try {
      const request = buildOpenAiBirthdayMessageRequest(input, {
        model: this.model,
        maxMessageLength: this.maxMessageLength
      });
      const response = await withTimeout(
        this.client.createResponse(request, controller.signal),
        this.timeoutMs,
        controller
      );
      const payload = readMessagePayload(response);
      const validation = validateGeneratedBirthdayMessage(payload.message, {
        maxLength: this.maxMessageLength,
        priorMessages: input.priorMessages
      });
      if (!validation.valid) {
        return this.createFallbackMessage(input, validation.reason ?? "VALIDATION_FAILED");
      }
      return {
        message: validation.message,
        provider: "openai",
        model: this.model,
        fallbackReason: null
      };
    } catch (error) {
      return this.createFallbackMessage(input, readFallbackReason(error));
    }
  }

  private createFallbackMessage(
    input: BirthdayMessageInput,
    reason: string
  ): GeneratedBirthdayMessage {
    return {
      message: createFallbackBirthdayMessage(input, this.maxMessageLength),
      provider: "fallback",
      model: null,
      fallbackReason: reason
    };
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  controller: AbortController
): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("OpenAI Responses API request timed out."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
}

export { OpenAiMessageGeneratorAdapter as OpenAiMessageGenerator };
