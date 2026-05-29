import {
  DEFAULT_MAX_BIRTHDAY_MESSAGE_LENGTH,
  type BirthdayMessageInput,
  type Person
} from "../../domain/index.js";
import type { OpenAiCreateResponseRequest } from "./openai-responses-client.js";
import type { JsonObject } from "./types.js";

const MAX_PRIOR_MESSAGES_IN_PROMPT = 5;

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

export function buildOpenAiBirthdayMessageRequest(
  input: BirthdayMessageInput,
  options: { model: string; maxMessageLength?: number } | string
): OpenAiCreateResponseRequest {
  const model = typeof options === "string" ? options : options.model;
  const maxMessageLength =
    typeof options === "string"
      ? DEFAULT_MAX_BIRTHDAY_MESSAGE_LENGTH
      : (options.maxMessageLength ?? DEFAULT_MAX_BIRTHDAY_MESSAGE_LENGTH);
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
