import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module.js";
import { BIRTHDAY_MESSAGE_GENERATOR } from "../../src/ai/index.js";
import { AUTOMATION_RUNNER, type AutomationRunner } from "../../src/automation/index.js";
import { DatabaseMigrationService } from "../../src/database/index.js";
import { BIRTHDAY_AUTOMATION_KEY, type Person } from "../../src/domain/index.js";
import type { MessageGenerator } from "../../src/infrastructure/ai/index.js";
import {
  InMemoryMetricsRegistry,
  JsonLogger,
  METRICS_REGISTRY,
  STRUCTURED_LOGGER,
  TargetsService,
  TypeOrmPersonRepository
} from "../../src/infrastructure/index.js";
import type { SendResult, WhatsAppClient } from "../../src/infrastructure/whatsapp/index.js";
import { WHATSAPP_CLIENT } from "../../src/whatsapp/index.js";

const now = new Date("2026-05-26T12:00:00.000Z");
const groupId = "family-group@g.us";
const env = {
  NODE_ENV: "test",
  APP_TIMEZONE: "America/Sao_Paulo",
  DAILY_CHECK_TIME: "09:00",
  DATABASE_PATH: ":memory:",
  WHATSAPP_AUTH_DIR: "unused-test-auth",
  WHATSAPP_GROUP_ID: groupId,
  OPENAI_API_KEY: "sk-test-secret-value",
  METRICS_ENABLED: "true",
  SCHEDULER_ENABLED: "false"
};

describe("observability integration", () => {
  it("emits useful logs and metrics without exposing personal profiles or secrets", async () => {
    const previousEnv = applyEnv(env);
    const logs: string[] = [];
    const logger = new JsonLogger({
      now: () => now,
      sink: (line) => logs.push(line)
    });
    const metrics = new InMemoryMetricsRegistry();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(WHATSAPP_CLIENT)
      .useValue(new FakeWhatsAppClient())
      .overrideProvider(BIRTHDAY_MESSAGE_GENERATOR)
      .useValue(new FallbackMessageGenerator())
      .overrideProvider(STRUCTURED_LOGGER)
      .useValue(logger)
      .overrideProvider(METRICS_REGISTRY)
      .useValue(metrics)
      .compile();
    try {
      await moduleRef.init();
      await moduleRef.get(DatabaseMigrationService).runMigrations();
      await seedBirthdayPerson(moduleRef.get(TypeOrmPersonRepository));
      await moduleRef.get(TargetsService).ensureLegacyBirthdayTarget();
      const runner = moduleRef.get<AutomationRunner>(AUTOMATION_RUNNER);
      await runner.run(BIRTHDAY_AUTOMATION_KEY, "startup", now);
      await runner.run(BIRTHDAY_AUTOMATION_KEY, "whatsapp-reconnect", now);
    } finally {
      restoreEnv(previousEnv);
      await moduleRef.close();
    }

    const joinedLogs = logs.join("\n");
    const renderedMetrics = metrics.renderPrometheus();
    expect(joinedLogs).toContain("birthday.people_matched");
    expect(joinedLogs).toContain("message.generation.fallback");
    expect(joinedLogs).toContain("message.delivery.sent");
    expect(joinedLogs).toContain("message.delivery.skipped");
    expect(joinedLogs).not.toContain("sk-test-secret-value");
    expect(joinedLogs).not.toContain("raw-session");
    expect(joinedLogs).not.toContain("Mensagem completa");
    expect(joinedLogs).not.toContain("Ana Maria");
    expect(renderedMetrics).toContain("birthday_people_matched_total 2");
    expect(renderedMetrics).toContain(
      'message_generation_fallbacks_total{automation="birthdays.daily",reason="OPENAI_ERROR"} 1'
    );
    expect(renderedMetrics).toContain(
      'message_deliveries_total{automation="birthdays.daily",status="sent"} 1'
    );
    expect(renderedMetrics).toContain(
      'message_deliveries_total{automation="birthdays.daily",status="skipped"} 1'
    );
    expect(renderedMetrics).toContain(
      'message_delivery_duplicates_total{automation="birthdays.daily"} 1'
    );
  });
});

class FallbackMessageGenerator implements MessageGenerator {
  async generate(input: { person: Person }) {
    return {
      message: `Mensagem completa para ${input.person.name}`,
      provider: "fallback" as const,
      model: null,
      fallbackReason: "OPENAI_ERROR",
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
      sentAt: now
    };
  }

  onReady(): void {
    return undefined;
  }
}

async function seedBirthdayPerson(people: TypeOrmPersonRepository): Promise<void> {
  await people.create({
    id: "person-1",
    name: "Ana Maria",
    birthDate: "1990-05-26",
    notes: "raw-session",
    createdAt: now,
    updatedAt: now
  });
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
