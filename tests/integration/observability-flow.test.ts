import { describe, expect, it } from "vitest";
import {
  openSqliteDatabase,
  runMigrations,
  type SqliteDatabase
} from "../../src/database/index.js";
import type { Person } from "../../src/domain/index.js";
import type { MessageGenerator, SendResult, WhatsAppClient } from "../../src/integrations/index.js";
import { InMemoryMetricsRegistry, JsonLogger } from "../../src/observability/index.js";
import { SqlitePersonRepository } from "../../src/repositories/index.js";
import { startProcess } from "../../src/process.js";

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
  METRICS_ENABLED: "true"
};

describe("observability integration", () => {
  it("emits useful logs and metrics without exposing personal profiles or secrets", async () => {
    const database = await createDatabaseWithBirthdayPerson();
    const logs: string[] = [];
    const logger = new JsonLogger({
      now: () => now,
      sink: (line) => logs.push(line)
    });
    const metrics = new InMemoryMetricsRegistry();
    const runtime = await startProcess({
      env,
      database,
      logger,
      metrics,
      whatsappClient: new FakeWhatsAppClient(),
      messageGenerator: new FallbackMessageGenerator(),
      runDatabaseMigrations: false,
      nowProvider: () => now,
      installSignalHandlers: false,
      metricsServer: null
    });

    await runtime.close();

    const joinedLogs = logs.join("\n");
    const renderedMetrics = metrics.renderPrometheus();
    expect(joinedLogs).toContain("birthday.check.started");
    expect(joinedLogs).toContain("birthday.message_generation.fallback");
    expect(joinedLogs).toContain("birthday.delivery.sent");
    expect(joinedLogs).not.toContain("sk-test-secret-value");
    expect(joinedLogs).not.toContain("raw-session");
    expect(joinedLogs).not.toContain("Mensagem completa");
    expect(joinedLogs).not.toContain("Ana Maria");
    expect(renderedMetrics).toContain('birthday_checks_total{status="completed"} 2');
    expect(renderedMetrics).toContain("birthday_birthdays_found_total 2");
    expect(renderedMetrics).toContain('birthday_delivery_attempts_total{status="sent"} 1');
    expect(renderedMetrics).toContain("birthday_message_generation_failures_total 1");
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
  private readonly readyHandlers: Array<() => Promise<void>> = [];
  private sent = false;

  async connect(): Promise<void> {
    await this.emitReady();
  }

  async sendGroupMessage(): Promise<SendResult> {
    if (this.sent) {
      throw new Error("raw-session should never be logged from duplicate path");
    }
    this.sent = true;
    return {
      providerMessageId: "provider-1",
      sentAt: now
    };
  }

  onReady(handler: () => Promise<void>): void {
    this.readyHandlers.push(handler);
  }

  async close(): Promise<void> {
    return undefined;
  }

  private async emitReady(): Promise<void> {
    for (const handler of this.readyHandlers) {
      await handler();
    }
  }
}

async function createDatabaseWithBirthdayPerson(): Promise<SqliteDatabase> {
  const database = await openSqliteDatabase({ path: ":memory:" });
  await runMigrations(database);
  const people = new SqlitePersonRepository(database, () => now);
  await people.create({
    id: "person-1",
    name: "Ana Maria",
    birthDate: "1990-05-26",
    notes: "raw-session"
  });
  return database;
}
