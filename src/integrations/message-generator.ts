import type { Person } from "../domain/index.js";

export interface BirthdayMessageInput {
  person: Person;
  priorMessages: string[];
  birthdayYear?: number;
}

export interface GeneratedMessage {
  message: string;
  provider: "openai" | "fallback";
  model: string | null;
  fallbackReason: string | null;
  fallbackDetails: OpenAiFallbackDetails | null;
}

export interface OpenAiFallbackDetails {
  status: number | null;
  statusText: string | null;
  requestId: string | null;
}

export interface MessageGenerator {
  generate(input: BirthdayMessageInput): Promise<GeneratedMessage>;
}

export interface OpenAiResponsesClient {
  createResponse(
    input: OpenAiCreateResponseRequest,
    signal: AbortSignal
  ): Promise<OpenAiCreateResponseResult>;
}

export interface OpenAiCreateResponseRequest {
  model: string;
  instructions: string;
  input: Array<{
    role: "user";
    content: Array<{
      type: "input_text";
      text: string;
    }>;
  }>;
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: boolean;
      schema: JsonObject;
    };
  };
  max_output_tokens: number;
  temperature: number;
  store: boolean;
}

export interface OpenAiCreateResponseResult {
  output_text?: unknown;
  output?: unknown;
}

export class OpenAiResponsesApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly requestId: string | null;
  readonly responseBody: string;

  constructor(options: {
    status: number;
    statusText: string;
    requestId: string | null;
    responseBody: string;
  }) {
    super(`OpenAI Responses API request failed with status ${options.status}.`);
    this.name = "OpenAiResponsesApiError";
    this.status = options.status;
    this.statusText = options.statusText;
    this.requestId = options.requestId;
    this.responseBody = options.responseBody;
  }
}

export interface OpenAiMessageGeneratorOptions {
  apiKey?: string | null;
  model: string;
  timeoutMs: number;
  client?: OpenAiResponsesClient;
  maxMessageLength?: number;
}

interface JsonObject {
  [key: string]: unknown;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  reason: string | null;
}

const DEFAULT_MAX_MESSAGE_LENGTH = 500;
const MAX_PRIOR_MESSAGES_IN_PROMPT = 5;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const SYSTEM_PROMPT = [
  "Voce escreve mensagens de feliz aniversario para um grupo familiar de WhatsApp.",
  "Escreva sempre em portugues brasileiro, com tom familiar, respeitoso e natural.",
  "Use apenas os dados fornecidos sobre a pessoa aniversariante.",
  "Nao invente fatos, conquistas, relacoes, apelidos, detalhes pessoais ou historicos.",
  "Evite conteudo ofensivo, constrangedor, sexual, comercial, politico, medico ou religioso.",
  "Se os dados forem limitados, escreva uma mensagem simples e segura.",
  "Nao mencione que voce e uma IA e nao use placeholders.",
  "Retorne somente JSON no schema solicitado."
].join(" ");

const BIRTHDAY_MESSAGE_SCHEMA: JsonObject = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: {
    message: {
      type: "string"
    }
  }
};

export class OpenAiMessageGenerator implements MessageGenerator {
  private readonly client: OpenAiResponsesClient | null;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxMessageLength: number;

  constructor(options: OpenAiMessageGeneratorOptions) {
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
    this.maxMessageLength = options.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH;
    this.client =
      options.client ??
      (options.apiKey === undefined || options.apiKey === null
        ? null
        : new FetchOpenAiResponsesClient(options.apiKey));
  }

  async generate(input: BirthdayMessageInput): Promise<GeneratedMessage> {
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
        fallbackReason: null,
        fallbackDetails: null
      };
    } catch (error) {
      return this.createFallbackMessage(
        input,
        readFallbackReason(error),
        readFallbackDetails(error)
      );
    }
  }

  private createFallbackMessage(
    input: BirthdayMessageInput,
    reason: string,
    fallbackDetails: OpenAiFallbackDetails | null = null
  ): GeneratedMessage {
    return {
      message: createFallbackBirthdayMessage(input, this.maxMessageLength),
      provider: "fallback",
      model: null,
      fallbackReason: reason,
      fallbackDetails
    };
  }
}

export class FetchOpenAiResponsesClient implements OpenAiResponsesClient {
  constructor(private readonly apiKey: string) {}

  async createResponse(
    input: OpenAiCreateResponseRequest,
    signal: AbortSignal
  ): Promise<OpenAiCreateResponseResult> {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new OpenAiResponsesApiError({
        status: response.status,
        statusText: response.statusText,
        requestId: readOpenAiRequestId(response),
        responseBody: await readResponseBody(response)
      });
    }
    return (await response.json()) as OpenAiCreateResponseResult;
  }
}

export function buildOpenAiBirthdayMessageRequest(
  input: BirthdayMessageInput,
  options: { model: string; maxMessageLength?: number } | string
): OpenAiCreateResponseRequest {
  const model = typeof options === "string" ? options : options.model;
  const maxMessageLength =
    typeof options === "string"
      ? DEFAULT_MAX_MESSAGE_LENGTH
      : (options.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH);
  return {
    model,
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Generate one birthday message for the configured WhatsApp family group.",
              constraints: {
                language: "pt-BR",
                maxCharacters: maxMessageLength,
                output: "Return JSON with a single message string.",
                avoidLiteralRepeatsFromPriorMessages: true
              },
              birthdayYear: input.birthdayYear ?? null,
              person: createMinimizedPersonProfile(input.person),
              priorMessages: sanitizePriorMessages(input.priorMessages)
            })
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "birthday_message",
        strict: true,
        schema: BIRTHDAY_MESSAGE_SCHEMA
      }
    },
    max_output_tokens: 220,
    temperature: 0.7,
    store: false
  };
}

export function validateGeneratedBirthdayMessage(
  value: unknown,
  options: { maxLength?: number; priorMessages?: string[] } = {}
): ValidationResult {
  if (typeof value !== "string") {
    return invalid("MESSAGE_NOT_STRING");
  }
  const message = normalizeMessageForSending(value);
  if (message.length === 0) {
    return invalid("MESSAGE_EMPTY");
  }
  if (message.length > (options.maxLength ?? DEFAULT_MAX_MESSAGE_LENGTH)) {
    return invalid("MESSAGE_TOO_LONG");
  }
  if (containsPlaceholder(message)) {
    return invalid("MESSAGE_CONTAINS_PLACEHOLDER");
  }
  if (containsInappropriateContent(message)) {
    return invalid("MESSAGE_CONTAINS_INAPPROPRIATE_CONTENT");
  }
  if (matchesPriorMessage(message, options.priorMessages ?? [])) {
    return invalid("MESSAGE_REPEATS_PRIOR_MESSAGE");
  }
  return {
    valid: true,
    message,
    reason: null
  };
}

export function createFallbackBirthdayMessage(
  input: BirthdayMessageInput,
  maxLength = DEFAULT_MAX_MESSAGE_LENGTH
): string {
  const displayName = readDisplayName(input.person);
  const style = normalizeForComparison(input.person.messageStyle ?? "");
  const templates = [
    `Feliz aniversario, ${displayName}! Que seu dia seja muito especial, com carinho, alegria e momentos bons ao lado das pessoas que te querem bem.`,
    `Parabens, ${displayName}! Desejo um dia leve, feliz e cheio de boas lembrancas. Que este novo ciclo venha com saude, paz e muitas alegrias.`,
    `${displayName}, feliz aniversario! Que hoje voce receba todo o carinho que merece e aproveite muito esse dia especial.`
  ];
  if (style.includes("divertido")) {
    templates.unshift(
      `Parabens, ${displayName}! Que seu dia seja leve, feliz e cheio de motivos para sorrir. Aproveite muito o seu aniversario!`
    );
  }
  const priorMessages = input.priorMessages.map(normalizeForComparison);
  const message =
    templates.find((template) => !priorMessages.includes(normalizeForComparison(template))) ??
    createNonRepeatingFallback(displayName, priorMessages);
  return truncateAtWordBoundary(message, maxLength);
}

function createMinimizedPersonProfile(person: Person): JsonObject {
  const profile: JsonObject = {
    name: person.name
  };
  addOptionalProfileField(profile, "nickname", person.nickname);
  addOptionalProfileField(profile, "relationship", person.relationship);
  addOptionalProfileField(profile, "profession", person.profession);
  addOptionalProfileField(profile, "hobbies", person.hobbies);
  addOptionalProfileField(profile, "traits", person.traits);
  addOptionalProfileField(profile, "messageStyle", person.messageStyle);
  addOptionalProfileField(profile, "notes", person.notes);
  return profile;
}

function addOptionalProfileField(profile: JsonObject, name: string, value: string | null): void {
  const sanitizedValue = sanitizeText(value);
  if (sanitizedValue !== null) {
    profile[name] = sanitizedValue;
  }
}

function sanitizePriorMessages(messages: string[]): string[] {
  return messages
    .map((message) => sanitizeText(message))
    .filter((message): message is string => message !== null)
    .slice(0, MAX_PRIOR_MESSAGES_IN_PROMPT);
}

function sanitizeText(value: string | null): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  return text.slice(0, 800);
}

function readMessagePayload(response: OpenAiCreateResponseResult): { message: unknown } {
  const outputText = readOutputText(response);
  const parsed = JSON.parse(outputText) as unknown;
  if (isMessagePayload(parsed)) {
    return parsed;
  }
  throw new Error("OpenAI response did not match the expected message payload.");
}

function readOutputText(response: OpenAiCreateResponseResult): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }
  const output = response.output;
  if (!Array.isArray(output)) {
    throw new Error("OpenAI response did not include output text.");
  }
  for (const item of output) {
    if (!isJsonObject(item) || item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (
        isJsonObject(content) &&
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        return content.text;
      }
    }
  }
  throw new Error("OpenAI response did not include output text.");
}

function isMessagePayload(value: unknown): value is { message: unknown } {
  return isJsonObject(value) && "message" in value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMessageForSending(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

function containsPlaceholder(message: string): boolean {
  return (
    /\{[^}]+\}/.test(message) ||
    /\[[^\]]+\]/.test(message) ||
    /<[^>]+>/.test(message) ||
    /\b(todo|lorem ipsum|placeholder|nome da pessoa|name here)\b/i.test(message)
  );
}

function containsInappropriateContent(message: string): boolean {
  const normalized = normalizeForComparison(message);
  const blockedTerms = [
    "sexo",
    "sexual",
    "pornografia",
    "politica",
    "eleicao",
    "religiao",
    "diagnostico",
    "doenca",
    "idiota",
    "burro",
    "merda",
    "porra",
    "caralho",
    "puta"
  ];
  return blockedTerms.some((term) => normalized.includes(term));
}

function matchesPriorMessage(message: string, priorMessages: string[]): boolean {
  const normalizedMessage = normalizeForComparison(message);
  return priorMessages.some(
    (priorMessage) => normalizeForComparison(priorMessage) === normalizedMessage
  );
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readDisplayName(person: Person): string {
  return sanitizeText(person.nickname) ?? sanitizeText(person.name) ?? "voce";
}

function truncateAtWordBoundary(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }
  const truncated = message.slice(0, maxLength).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace <= 0) {
    return truncated;
  }
  return truncated.slice(0, lastSpace);
}

function createNonRepeatingFallback(displayName: string, priorMessages: string[]): string {
  const baseMessage = `Feliz aniversario, ${displayName}! Receba nosso carinho neste dia especial e que seu novo ciclo venha com paz, saude e alegrias.`;
  if (!priorMessages.includes(normalizeForComparison(baseMessage))) {
    return baseMessage;
  }
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const candidate = `${baseMessage} Um abraco especial de todos nos${"!".repeat(attempt)}`;
    if (!priorMessages.includes(normalizeForComparison(candidate))) {
      return candidate;
    }
  }
  return `${baseMessage} Que hoje seja mais um motivo para celebrar voce com muito carinho.`;
}

function invalid(reason: string): ValidationResult {
  return {
    valid: false,
    message: "",
    reason
  };
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

function readFallbackReason(error: unknown): string {
  if (error instanceof OpenAiResponsesApiError) {
    return `OPENAI_HTTP_${error.status}`;
  }
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("timed out")) {
      return "OPENAI_TIMEOUT";
    }
    return error.name === "Error" ? "OPENAI_ERROR" : error.name;
  }
  return "OPENAI_ERROR";
}

function readFallbackDetails(error: unknown): OpenAiFallbackDetails | null {
  if (error instanceof OpenAiResponsesApiError) {
    return {
      status: error.status,
      statusText: error.statusText || null,
      requestId: error.requestId
    };
  }
  return null;
}

function readOpenAiRequestId(response: Response): string | null {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    response.headers.get("openai-request-id") ??
    null
  );
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
