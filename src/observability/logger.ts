export type LogLevel = "info" | "warn" | "error";

export interface StructuredLogger {
  info(fields: Record<string, unknown>): void;
  warn(fields: Record<string, unknown>): void;
  error(fields: Record<string, unknown>): void;
}

export interface JsonLoggerOptions {
  sink?: (line: string, level: LogLevel) => void;
  now?: () => Date;
}

const REDACTED = "[redacted]";
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 300;
const SENSITIVE_KEY_PATTERN =
  /(api[-_]?key|authorization|auth|credential|password|qr|secret|session|token|message[-_]?text|raw[-_]?payload)/i;
const SECRET_VALUE_PATTERN =
  /\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]+|[A-Za-z0-9+/]{80,}={0,2})\b/g;

export class JsonLogger implements StructuredLogger {
  private readonly sink: (line: string, level: LogLevel) => void;
  private readonly now: () => Date;

  constructor(options: JsonLoggerOptions = {}) {
    this.sink = options.sink ?? writeConsoleLine;
    this.now = options.now ?? (() => new Date());
  }

  info(fields: Record<string, unknown>): void {
    this.write("info", fields);
  }

  warn(fields: Record<string, unknown>): void {
    this.write("warn", fields);
  }

  error(fields: Record<string, unknown>): void {
    this.write("error", fields);
  }

  private write(level: LogLevel, fields: Record<string, unknown>): void {
    const entry = sanitizeLogFields({
      level,
      timestamp: this.now().toISOString(),
      ...fields
    });
    this.sink(JSON.stringify(entry), level);
  }
}

export const nullLogger: StructuredLogger = {
  info() {
    return undefined;
  },
  warn() {
    return undefined;
  },
  error() {
    return undefined;
  }
};

export function sanitizeLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(fields, 0);
}

export function readErrorCode(error: unknown): string {
  if (isCodeError(error)) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "UNKNOWN_ERROR";
}

export function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeText(error.message);
  }
  return "Unknown error.";
}

function sanitizeRecord(fields: Record<string, unknown>, depth: number): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    sanitized[key] = sanitizeValue(key, value, depth);
  }
  return sanitized;
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    if (typeof value === "boolean" || typeof value === "number" || value === null) {
      return value;
    }
    return REDACTED;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: readErrorMessage(value)
    };
  }
  if (typeof value === "string") {
    return sanitizeText(value);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return "[max-depth]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item, depth + 1));
  }
  return sanitizeRecord(value as Record<string, unknown>, depth + 1);
}

function sanitizeText(value: string): string {
  const redacted = value.replace(SECRET_VALUE_PATTERN, REDACTED);
  if (redacted.length <= MAX_STRING_LENGTH) {
    return redacted;
  }
  return `${redacted.slice(0, MAX_STRING_LENGTH)}...`;
}

function isCodeError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

function writeConsoleLine(line: string, level: LogLevel): void {
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
