import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_DATABASE_PATH,
  DEFAULT_DAILY_CHECK_TIME,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_TIMEOUT_MS,
  DEFAULT_TIMEZONE,
  DEFAULT_WHATSAPP_AUTH_DIR,
  loadAppConfig
} from "../../src/config/index.js";

describe("loadAppConfig", () => {
  it("uses safe defaults without exposing secret values", () => {
    const config = loadAppConfig({});

    expect(config).toEqual({
      nodeEnv: "development",
      timezone: DEFAULT_TIMEZONE,
      dailyCheckTime: DEFAULT_DAILY_CHECK_TIME,
      databasePath: DEFAULT_DATABASE_PATH,
      whatsappAuthDir: DEFAULT_WHATSAPP_AUTH_DIR,
      whatsappGroupId: null,
      openAi: {
        apiKey: null,
        model: DEFAULT_OPENAI_MODEL,
        timeoutMs: DEFAULT_OPENAI_TIMEOUT_MS
      },
      openAiApiKeyConfigured: false
    });
  });

  it("reports whether secrets are configured without returning them", () => {
    const config = loadAppConfig({
      NODE_ENV: "test",
      APP_TIMEZONE: "America/Sao_Paulo",
      DAILY_CHECK_TIME: "09:00",
      DATABASE_PATH: "data/test.sqlite",
      WHATSAPP_AUTH_DIR: "sessions/test",
      WHATSAPP_GROUP_ID: "family-group@g.us",
      OPENAI_API_KEY: "secret-key",
      OPENAI_MODEL: "gpt-4.1-mini",
      OPENAI_TIMEOUT_MS: "5000"
    });

    expect(config.openAiApiKeyConfigured).toBe(true);
    expect(config.openAi.apiKey?.reveal()).toBe("secret-key");
    expect(config.openAi.timeoutMs).toBe(5000);
    expect(JSON.stringify(config)).not.toContain("secret-key");
  });

  it("rejects invalid environment values with clear non-secret errors", () => {
    expect(() =>
      loadAppConfig({
        APP_TIMEZONE: "invalid/timezone",
        OPENAI_API_KEY: "secret-key"
      })
    ).toThrow(new ConfigError("APP_TIMEZONE must be a valid IANA timezone."));
    expect(() =>
      loadAppConfig({
        DAILY_CHECK_TIME: "25:00",
        OPENAI_API_KEY: "secret-key"
      })
    ).toThrow(new ConfigError("DAILY_CHECK_TIME must use HH:mm in 24-hour format."));
    expect(() =>
      loadAppConfig({
        OPENAI_TIMEOUT_MS: "0",
        OPENAI_API_KEY: "secret-key"
      })
    ).toThrow(new ConfigError("OPENAI_TIMEOUT_MS must be a positive integer."));
  });

  it("requires operational secrets only for process startup", () => {
    expect(() => loadAppConfig({}, { requireOperationalSecrets: true })).toThrow(
      new ConfigError("OPENAI_API_KEY is required for operational startup.")
    );
    expect(() =>
      loadAppConfig(
        {
          OPENAI_API_KEY: "secret-key"
        },
        { requireOperationalSecrets: true }
      )
    ).toThrow(new ConfigError("WHATSAPP_GROUP_ID is required for operational startup."));
  });
});
