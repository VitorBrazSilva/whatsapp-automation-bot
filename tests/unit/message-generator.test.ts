import { describe, expect, it } from "vitest";
import {
  createFallbackBirthdayMessage,
  validateGeneratedBirthdayMessage,
  type Person
} from "../../src/domain/index.js";
import {
  buildOpenAiBirthdayMessageRequest,
  OpenAiMessageGeneratorAdapter,
  OpenAiResponsesApiError,
  type OpenAiCreateResponseRequest,
  type OpenAiCreateResponseResult,
  type OpenAiResponsesClient
} from "../../src/infrastructure/ai/index.js";

const now = new Date("2026-05-26T12:00:00.000Z");

describe("OpenAiMessageGenerator", () => {
  it("builds a structured Responses API request with minimized person data", () => {
    const request = buildOpenAiBirthdayMessageRequest(
      {
        person: createPerson({
          id: "person-1",
          name: "Ana",
          nickname: "Aninha",
          birthDate: "1990-05-26",
          relationship: "prima",
          profession: "professora",
          hobbies: "jardinagem",
          traits: "cuidadosa",
          messageStyle: "carinhoso",
          notes: "Gosta de mensagens simples."
        }),
        priorMessages: ["Mensagem antiga"],
        birthdayYear: 2026
      },
      "gpt-4.1-mini"
    );

    const payload = JSON.parse(request.input[0]?.content[0]?.text ?? "{}") as {
      person: Record<string, unknown>;
      priorMessages: string[];
      constraints: { maxCharacters: number };
    };
    expect(request.text.format.type).toBe("json_schema");
    expect(request.text.format.strict).toBe(true);
    expect(request.text.format.schema).toEqual({
      type: "object",
      additionalProperties: false,
      required: ["message"],
      properties: {
        message: {
          type: "string"
        }
      }
    });
    expect(request.store).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("person-1");
    expect(JSON.stringify(payload)).not.toContain("1990-05-26");
    expect(payload.person).toMatchObject({
      name: "Ana",
      nickname: "Aninha",
      relationship: "prima",
      notes: "Gosta de mensagens simples."
    });
    expect(payload.priorMessages).toEqual(["Mensagem antiga"]);
    expect(payload.constraints.maxCharacters).toBe(500);
  });

  it("returns a validated OpenAI message when the response matches the schema", async () => {
    const client = new FakeOpenAiClient({
      output_text: JSON.stringify({ message: "Feliz aniversario, Ana! Que seu dia seja especial." })
    });
    const generator = new OpenAiMessageGeneratorAdapter({
      model: "gpt-4.1-mini",
      timeoutMs: 100,
      client,
      maxMessageLength: 120
    });

    const result = await generator.generate({
      person: createPerson({ name: "Ana" }),
      priorMessages: []
    });

    expect(result).toEqual({
      message: "Feliz aniversario, Ana! Que seu dia seja especial.",
      provider: "openai",
      model: "gpt-4.1-mini",
      fallbackReason: null
    });
    expect(client.requests).toHaveLength(1);
    const payload = JSON.parse(client.requests[0]?.input[0]?.content[0]?.text ?? "{}") as {
      constraints: { maxCharacters: number };
    };
    expect(payload.constraints.maxCharacters).toBe(120);
  });

  it("falls back when OpenAI times out", async () => {
    const client = new NeverResolvingOpenAiClient();
    const generator = new OpenAiMessageGeneratorAdapter({
      model: "gpt-4.1-mini",
      timeoutMs: 5,
      client
    });

    const result = await generator.generate({
      person: createPerson({ name: "Ana" }),
      priorMessages: []
    });

    expect(result.provider).toBe("fallback");
    expect(result.fallbackReason).toBe("OPENAI_TIMEOUT");
    expect(result.message).toContain("Ana");
    expect(client.signal?.aborted).toBe(true);
  });

  it("falls back when the OpenAI message repeats prior history", async () => {
    const repeatedMessage = "Parabens, Ana! Mensagem antiga.";
    const client = new FakeOpenAiClient({
      output_text: JSON.stringify({ message: repeatedMessage })
    });
    const generator = new OpenAiMessageGeneratorAdapter({
      model: "gpt-4.1-mini",
      timeoutMs: 100,
      client
    });

    const result = await generator.generate({
      person: createPerson({ name: "Ana" }),
      priorMessages: [repeatedMessage]
    });

    expect(result.provider).toBe("fallback");
    expect(result.fallbackReason).toBe("MESSAGE_REPEATS_PRIOR_MESSAGE");
    expect(result.message).not.toBe(repeatedMessage);
  });

  it("preserves OpenAI HTTP metadata when the request fails", async () => {
    const client = new ThrowingOpenAiClient(
      new OpenAiResponsesApiError({
        status: 500,
        statusText: "Internal Server Error",
        requestId: "req-test-123",
        responseBody: '{"error":"boom"}'
      })
    );
    const generator = new OpenAiMessageGeneratorAdapter({
      model: "gpt-4.1-mini",
      timeoutMs: 100,
      client
    });

    const result = await generator.generate({
      person: createPerson({ name: "Ana" }),
      priorMessages: []
    });

    expect(result.provider).toBe("fallback");
    expect(result.fallbackReason).toBe("OPENAI_HTTP_500");
  });
});

describe("birthday message validation and fallback", () => {
  it("rejects empty, long, placeholder, inappropriate and repeated messages", () => {
    expect(validateGeneratedBirthdayMessage("   ").reason).toBe("MESSAGE_EMPTY");
    expect(validateGeneratedBirthdayMessage("a".repeat(501)).reason).toBe("MESSAGE_TOO_LONG");
    expect(validateGeneratedBirthdayMessage("Feliz aniversario, [nome]!").reason).toBe(
      "MESSAGE_CONTAINS_PLACEHOLDER"
    );
    expect(validateGeneratedBirthdayMessage("Feliz aniversario com politica no meio.").reason).toBe(
      "MESSAGE_CONTAINS_INAPPROPRIATE_CONTENT"
    );
    expect(
      validateGeneratedBirthdayMessage("Feliz aniversario, Ana!", {
        priorMessages: [" Feliz   aniversario, Ana! "]
      }).reason
    ).toBe("MESSAGE_REPEATS_PRIOR_MESSAGE");
  });

  it("chooses a safe fallback that avoids exact prior messages when possible", () => {
    const person = createPerson({ name: "Ana" });
    const firstFallback = createFallbackBirthdayMessage({ person, priorMessages: [] });
    const secondFallback = createFallbackBirthdayMessage({
      person,
      priorMessages: [firstFallback]
    });

    expect(secondFallback).toContain("Ana");
    expect(secondFallback).not.toBe(firstFallback);
  });

  it("creates a distinct fallback even when every template was already used", () => {
    const person = createPerson({ name: "Ana" });
    const usedMessages: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      usedMessages.push(createFallbackBirthdayMessage({ person, priorMessages: usedMessages }));
    }

    const fallback = createFallbackBirthdayMessage({ person, priorMessages: usedMessages });

    expect(fallback).toContain("Ana");
    expect(usedMessages).not.toContain(fallback);
  });
});

class FakeOpenAiClient implements OpenAiResponsesClient {
  readonly requests: OpenAiCreateResponseRequest[] = [];

  constructor(private readonly response: OpenAiCreateResponseResult) {}

  async createResponse(
    input: OpenAiCreateResponseRequest,
    signal: AbortSignal
  ): Promise<OpenAiCreateResponseResult> {
    void signal;
    this.requests.push(input);
    return this.response;
  }
}

class NeverResolvingOpenAiClient implements OpenAiResponsesClient {
  signal: AbortSignal | null = null;

  async createResponse(
    _input: OpenAiCreateResponseRequest,
    signal: AbortSignal
  ): Promise<OpenAiCreateResponseResult> {
    this.signal = signal;
    return new Promise(() => undefined);
  }
}

class ThrowingOpenAiClient implements OpenAiResponsesClient {
  constructor(private readonly error: Error) {}

  async createResponse(): Promise<OpenAiCreateResponseResult> {
    throw this.error;
  }
}

function createPerson(overrides: Partial<Person>): Person {
  return {
    id: "person-1",
    name: "Ana",
    nickname: null,
    birthDate: "1990-05-26",
    relationship: null,
    profession: null,
    hobbies: null,
    traits: null,
    messageStyle: null,
    notes: null,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}
