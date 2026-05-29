import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module.js";
import { BIRTHDAY_MESSAGE_GENERATOR } from "../../src/ai/index.js";
import type { Person } from "../../src/domain/index.js";
import type { MessageGenerator } from "../../src/infrastructure/ai/index.js";
import type { SendResult, WhatsAppClient } from "../../src/infrastructure/whatsapp/index.js";
import { WHATSAPP_CLIENT } from "../../src/whatsapp/index.js";

const env = {
  NODE_ENV: "test",
  DATABASE_PATH: ":memory:",
  WHATSAPP_GROUP_ID: "family-group@g.us",
  OPENAI_API_KEY: "test-key",
  METRICS_ENABLED: "true",
  SCHEDULER_ENABLED: "false"
};

describe("health and metrics e2e", () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it("serves liveness, readiness, and Prometheus metrics", async () => {
    const previousEnv = applyEnv(env);
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule]
      })
        .overrideProvider(WHATSAPP_CLIENT)
        .useValue(new FakeWhatsAppClient())
        .overrideProvider(BIRTHDAY_MESSAGE_GENERATOR)
        .useValue(new FakeMessageGenerator())
        .compile();
      app = moduleRef.createNestApplication();
      await app.init();
    } finally {
      restoreEnv(previousEnv);
    }

    await request(app.getHttpServer()).get("/health/live").expect(200).expect({ status: "ok" });
    await request(app.getHttpServer())
      .get("/health/ready")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "ok",
          checks: {
            database: "ok",
            whatsapp: "ok"
          }
        });
      });
    await request(app.getHttpServer())
      .get("/metrics")
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain("# HELP automation_runs_total");
        expect(text).toContain("# HELP whatsapp_connection_state");
      });
  });
});

class FakeMessageGenerator implements MessageGenerator {
  async generate(input: { person: Person }) {
    return {
      message: `Parabens, ${input.person.name}!`,
      provider: "fallback" as const,
      model: null,
      fallbackReason: null,
      fallbackDetails: null
    };
  }
}

class FakeWhatsAppClient implements WhatsAppClient {
  async connect(): Promise<void> {
    return undefined;
  }

  async sendGroupMessage(): Promise<SendResult> {
    return {
      providerMessageId: "provider-1",
      sentAt: new Date("2026-05-26T12:00:00.000Z")
    };
  }

  onReady(): void {
    return undefined;
  }
}

function applyEnv(values: NodeJS.ProcessEnv): Map<string, string | undefined> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  return previous;
}

function restoreEnv(previous: Map<string, string | undefined>): void {
  for (const [key, value] of previous) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}
