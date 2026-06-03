export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
export const DEFAULT_DAILY_CHECK_TIME = "09:00";
export const DEFAULT_APP_NAME = "birthday-whatsapp-bot";
export const DEFAULT_DATABASE_PATH = "data/birthday-whatsapp.sqlite";
export const DEFAULT_WHATSAPP_AUTH_DIR = "sessions/baileys";
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
export const DEFAULT_OPENAI_TIMEOUT_MS = 15000;
export const DEFAULT_SCHEDULER_ENABLED = true;

export type RuntimeEnvironment = "development" | "test" | "production";

export interface SecretValue {
  reveal(): string;
  toJSON(): string;
}

export interface OpenAiConfig {
  apiKey: SecretValue | null;
  model: string;
  timeoutMs: number;
}

export interface AppConfig {
  appName: string;
  nodeEnv: RuntimeEnvironment;
  timezone: string;
  dailyCheckTime: string;
  schedulerEnabled: boolean;
  databasePath: string;
  whatsappAuthDir: string;
  whatsappGroupId: string | null;
  openAi: OpenAiConfig;
  openAiApiKeyConfigured: boolean;
}

export interface LoadAppConfigOptions {
  requireOperationalSecrets?: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadAppConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadAppConfigOptions = {}
): AppConfig {
  const openAiApiKey = readOptionalValue(env.OPENAI_API_KEY);
  const whatsappGroupId = readOptionalValue(env.WHATSAPP_GROUP_ID);
  if (options.requireOperationalSecrets) {
    requireValue("OPENAI_API_KEY", openAiApiKey);
    requireValue("WHATSAPP_GROUP_ID", whatsappGroupId);
  }
  return {
    appName: readRequiredText("APP_NAME", env.APP_NAME, DEFAULT_APP_NAME),
    nodeEnv: readNodeEnv(env.NODE_ENV),
    timezone: readTimezone(env.APP_TIMEZONE),
    dailyCheckTime: readDailyCheckTime(env.DAILY_CHECK_TIME),
    schedulerEnabled: readBoolean(
      "SCHEDULER_ENABLED",
      env.SCHEDULER_ENABLED,
      DEFAULT_SCHEDULER_ENABLED
    ),
    databasePath: readRequiredPath("DATABASE_PATH", env.DATABASE_PATH, DEFAULT_DATABASE_PATH),
    whatsappAuthDir: readRequiredPath(
      "WHATSAPP_AUTH_DIR",
      env.WHATSAPP_AUTH_DIR,
      DEFAULT_WHATSAPP_AUTH_DIR
    ),
    whatsappGroupId,
    openAi: {
      apiKey: openAiApiKey === null ? null : createSecretValue(openAiApiKey),
      model: readRequiredText("OPENAI_MODEL", env.OPENAI_MODEL, DEFAULT_OPENAI_MODEL),
      timeoutMs: readPositiveInteger(
        "OPENAI_TIMEOUT_MS",
        env.OPENAI_TIMEOUT_MS,
        DEFAULT_OPENAI_TIMEOUT_MS
      )
    },
    openAiApiKeyConfigured: openAiApiKey !== null
  };
}

function readNodeEnv(value: string | undefined): RuntimeEnvironment {
  const normalizedValue = readOptionalValue(value);
  if (normalizedValue === null) {
    return "development";
  }
  if (
    normalizedValue === "development" ||
    normalizedValue === "production" ||
    normalizedValue === "test"
  ) {
    return normalizedValue;
  }
  throw new ConfigError("NODE_ENV must be development, test, or production.");
}

function readOptionalValue(value: string | undefined): string | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }
  return normalizedValue;
}

function readTimezone(value: string | undefined): string {
  const timezone = readOptionalValue(value) ?? DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    throw new ConfigError("APP_TIMEZONE must be a valid IANA timezone.");
  }
}

function readDailyCheckTime(value: string | undefined): string {
  const dailyCheckTime = readOptionalValue(value) ?? DEFAULT_DAILY_CHECK_TIME;
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (timePattern.test(dailyCheckTime)) {
    return dailyCheckTime;
  }
  throw new ConfigError("DAILY_CHECK_TIME must use HH:mm in 24-hour format.");
}

function readRequiredPath(name: string, value: string | undefined, fallback: string): string {
  const path = readOptionalValue(value) ?? fallback;
  if (path.includes("\0")) {
    throw new ConfigError(`${name} must be a valid filesystem path.`);
  }
  return path;
}

function readRequiredText(name: string, value: string | undefined, fallback: string): string {
  const text = readOptionalValue(value) ?? fallback;
  if (text.length > 0) {
    return text;
  }
  throw new ConfigError(`${name} must not be empty.`);
}

function readPositiveInteger(name: string, value: string | undefined, fallback: number): number {
  const text = readOptionalValue(value);
  if (text === null) {
    return fallback;
  }
  const numberValue = Number(text);
  if (Number.isInteger(numberValue) && numberValue > 0) {
    return numberValue;
  }
  throw new ConfigError(`${name} must be a positive integer.`);
}

function readBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  const text = readOptionalValue(value);
  if (text === null) {
    return fallback;
  }
  if (text === "true" || text === "1") {
    return true;
  }
  if (text === "false" || text === "0") {
    return false;
  }
  throw new ConfigError(`${name} must be true or false.`);
}

function requireValue(name: string, value: string | null): void {
  if (value !== null) {
    return;
  }
  throw new ConfigError(`${name} is required for operational startup.`);
}

function createSecretValue(value: string): SecretValue {
  return {
    reveal: () => value,
    toJSON: () => "[configured]"
  };
}
