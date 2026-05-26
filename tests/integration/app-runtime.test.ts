import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("app runtime", () => {
  it("loads the service without network or provider dependencies", () => {
    const startedAt = new Date("2026-05-25T12:00:00.000Z");
    const app = createApp({
      env: {
        NODE_ENV: "test",
        OPENAI_API_KEY: "test-key",
        WHATSAPP_GROUP_ID: "family-group@g.us"
      },
      now: startedAt,
      requireOperationalConfig: true
    });

    expect(app).toMatchObject({
      status: "ready",
      startedAt
    });
    expect(app.config.nodeEnv).toBe("test");
    expect(JSON.stringify(app.config)).not.toContain("test-key");
  });
});
