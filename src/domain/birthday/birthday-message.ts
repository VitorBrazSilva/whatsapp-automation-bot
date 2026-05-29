import type { Person } from "./person.js";

export const DEFAULT_MAX_BIRTHDAY_MESSAGE_LENGTH = 500;

export interface BirthdayMessageInput {
  person: Person;
  priorMessages: string[];
  birthdayYear?: number;
}

export interface BirthdayMessageValidationResult {
  valid: boolean;
  message: string;
  reason: string | null;
}

export function validateGeneratedBirthdayMessage(
  value: unknown,
  options: { maxLength?: number; priorMessages?: string[] } = {}
): BirthdayMessageValidationResult {
  if (typeof value !== "string") {
    return invalid("MESSAGE_NOT_STRING");
  }
  const message = normalizeMessageForSending(value);
  if (message.length === 0) {
    return invalid("MESSAGE_EMPTY");
  }
  if (message.length > (options.maxLength ?? DEFAULT_MAX_BIRTHDAY_MESSAGE_LENGTH)) {
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
  maxLength = DEFAULT_MAX_BIRTHDAY_MESSAGE_LENGTH
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

export function normalizeMessageForSending(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

export function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

function readDisplayName(person: Person): string {
  return sanitizeText(person.nickname) ?? sanitizeText(person.name) ?? "voce";
}

function sanitizeText(value: string | null): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  return text.slice(0, 800);
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

function invalid(reason: string): BirthdayMessageValidationResult {
  return {
    valid: false,
    message: "",
    reason
  };
}
