import { describe, expect, it } from "vitest";
import { createBirthdayBotRuntime } from "../../src/app.js";
import { runCheckTodayCommand } from "../../src/cli/check-today-command.js";
import { runDbMigrateCommand } from "../../src/cli/db-migrate-command.js";
import { runListGroupsCommand } from "../../src/cli/list-groups-command.js";
import {
  openSqliteDatabase,
  runMigrations,
  type SqliteDatabase
} from "../../src/database/index.js";
import type { Person } from "../../src/domain/index.js";
import type {
  MessageGenerator,
  SendResult,
  WhatsAppClient,
  WhatsAppGroup
} from "../../src/integrations/index.js";
import { startProcess } from "../../src/process.js";
import { SqlitePersonRepository } from "../../src/repositories/index.js";

const now = new Date("2026-05-26T12:00:00.000Z");
const groupId = "family-group@g.us";
const env = {
  NODE_ENV: "test",
  APP_TIMEZONE: "America/Sao_Paulo",
  DAILY_CHECK_TIME: "09:00",
  DATABASE_PATH: ":memory:",
  WHATSAPP_AUTH_DIR: "unused-test-auth",
  WHATSAPP_GROUP_ID: groupId,
  OPENAI_API_KEY: "test-key"
};

describe("operational flow", () => {
  it("runs check:today manually with real repositories and fake providers", async () => {
    const database = await createDatabaseWithBirthdayPerson();
    const whatsapp = new FakeWhatsAppClient();
    const output: string[] = [];

    const command = await runCheckTodayCommand({
      env,
      database,
      whatsappClient: whatsapp,
      messageGenerator: new FakeMessageGenerator(),
      runDatabaseMigrations: false,
      nowProvider: () => now,
      stdout: (line) => output.push(line)
    });

    expect(command.result).toMatchObject({
      trigger: "manual",
      birthdaysFound: 1,
      deliveriesSent: 1,
      duplicateSkips: 0,
      failures: 0
    });
    expect(whatsapp.connected).toBe(true);
    expect(whatsapp.sentMessages).toEqual([{ groupId, text: "Parabens, Ana!" }]);
    expect(JSON.parse(output[0] ?? "{}")).toMatchObject({
      event: "birthday.check_today.completed",
      trigger: "manual"
    });
  });

  it("wires startup and WhatsApp ready recovery through the operational process", async () => {
    const database = await createDatabaseWithBirthdayPerson();
    const whatsapp = new FakeWhatsAppClient();
    const runtime = await startProcess({
      env,
      database,
      whatsappClient: whatsapp,
      messageGenerator: new FakeMessageGenerator(),
      runDatabaseMigrations: false,
      nowProvider: () => now,
      installSignalHandlers: false
    });

    expect(whatsapp.sentMessages).toEqual([{ groupId, text: "Parabens, Ana!" }]);

    await whatsapp.emitReady();

    expect(whatsapp.sentMessages).toEqual([{ groupId, text: "Parabens, Ana!" }]);
    await runtime.close();
  });

  it("lists groups with a fake WhatsApp client", async () => {
    const output: string[] = [];
    const groups: WhatsAppGroup[] = [
      { id: "family@g.us", subject: "Familia", participantCount: 5 }
    ];

    const result = await runListGroupsCommand({
      env,
      whatsappClient: new FakeGroupClient(groups),
      stdout: (line) => output.push(line)
    });

    expect(result.groups).toEqual(groups);
    expect(JSON.parse(output[0] ?? "{}")).toEqual({
      event: "whatsapp.list_groups.completed",
      groups
    });
  });

  it("runs db:migrate against an injected database", async () => {
    const database = await openSqliteDatabase({ path: ":memory:" });
    const output: string[] = [];

    const result = await runDbMigrateCommand({
      env,
      database,
      stdout: (line) => output.push(line)
    });

    expect(result.appliedCount).toBe(1);
    expect(database.get("SELECT version FROM schema_migrations WHERE version = 1")).not.toBeNull();
    expect(JSON.parse(output[0] ?? "{}")).toEqual({
      event: "database.migrations.completed",
      appliedCount: 1
    });
    database.close();
  });

  it("can compose the operational runtime without starting network providers", async () => {
    const database = await createDatabaseWithBirthdayPerson();
    const runtime = await createBirthdayBotRuntime({
      env,
      database,
      whatsappClient: new FakeWhatsAppClient(),
      messageGenerator: new FakeMessageGenerator(),
      runDatabaseMigrations: false,
      nowProvider: () => now
    });

    expect(runtime.status).toBe("ready");
    await runtime.close();
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
  readonly sentMessages: Array<{ groupId: string; text: string }> = [];
  private readonly readyHandlers: Array<() => Promise<void>> = [];
  connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    await this.emitReady();
  }

  async sendGroupMessage(groupIdValue: string, text: string): Promise<SendResult> {
    this.sentMessages.push({ groupId: groupIdValue, text });
    return {
      providerMessageId: `provider-${this.sentMessages.length}`,
      sentAt: now
    };
  }

  onReady(handler: () => Promise<void>): void {
    this.readyHandlers.push(handler);
  }

  async emitReady(): Promise<void> {
    for (const handler of this.readyHandlers) {
      await handler();
    }
  }

  async close(): Promise<void> {
    return undefined;
  }
}

class FakeGroupClient {
  connected = false;

  constructor(private readonly groups: WhatsAppGroup[]) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async listGroups(): Promise<WhatsAppGroup[]> {
    return this.groups;
  }

  async close(): Promise<void> {
    return undefined;
  }
}

async function createDatabaseWithBirthdayPerson(): Promise<SqliteDatabase> {
  const database = await openSqliteDatabase({ path: ":memory:" });
  await runMigrations(database);
  const people = new SqlitePersonRepository(database, () => now);
  await people.create({
    id: "person-1",
    name: "Ana",
    birthDate: "1990-05-26"
  });
  return database;
}
