import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module.js";
import type {
  BirthdayMessageGenerator,
  RunBirthdayReminderUseCasePort,
  WhatsAppGroup,
  WhatsAppGroupMessenger
} from "../../src/application/index.js";
import { DatabaseMigrationService } from "../../src/database/index.js";
import type { BirthdayMessageInput } from "../../src/domain/index.js";
import {
  BIRTHDAY_MESSAGE_GENERATOR,
  RUN_BIRTHDAY_REMINDER_USE_CASE,
  TypeOrmPersonRepository,
  WHATSAPP_CLIENT
} from "../../src/infrastructure/index.js";
import { runCheckTodayCommand } from "../../src/presentation/cli/check-today-command.js";
import { runDbMigrateCommand } from "../../src/presentation/cli/db-migrate-command.js";
import { runListGroupsCommand } from "../../src/presentation/cli/list-groups-command.js";
import { startProcess } from "../../src/process.js";

const now = new Date("2026-05-26T12:00:00.000Z");
const groupJid = "family-group@g.us";
const env = {
  NODE_ENV: "test",
  APP_TIMEZONE: "America/Sao_Paulo",
  DAILY_CHECK_TIME: "09:00",
  DATABASE_PATH: ":memory:",
  WHATSAPP_AUTH_DIR: "unused-test-auth",
  WHATSAPP_GROUP_ID: groupJid,
  OPENAI_API_KEY: "test-key",
  SCHEDULER_ENABLED: "false"
};

describe("operational flow", () => {
  it("runs the birthday reminder through the Nest application context", async () => {
    const whatsapp = new FakeWhatsAppClient();
    const context = await createTestContext(whatsapp);
    await seedBirthdayPerson(context);

    const result = await context
      .get<RunBirthdayReminderUseCasePort>(RUN_BIRTHDAY_REMINDER_USE_CASE)
      .execute({ now, trigger: "manual" });

    expect(result).toEqual({
      peopleMatched: 1,
      sent: 1,
      skipped: 0,
      failed: 0
    });
    expect(whatsapp.sentMessages).toEqual([{ groupJid, text: "Parabens, Ana!" }]);
    await context.close();
  });

  it("runs birthdays:check-today with fake providers", async () => {
    const whatsapp = new FakeWhatsAppClient();
    const context = await createTestContext(whatsapp);
    const output: string[] = [];
    await seedBirthdayPerson(context);

    const command = await runCheckTodayCommand({
      context,
      now,
      stdout: (line) => output.push(line)
    });

    expect(command.result).toEqual({
      peopleMatched: 1,
      sent: 1,
      skipped: 0,
      failed: 0
    });
    expect(whatsapp.connected).toBe(true);
    expect(JSON.parse(output[0] ?? "{}")).toMatchObject({
      event: "birthdays.check_today.completed",
      trigger: "manual"
    });
    await context.close();
  });

  it("lists groups with a fake WhatsApp client", async () => {
    const groups: WhatsAppGroup[] = [
      { id: "family@g.us", subject: "Familia", participantCount: 5 }
    ];
    const context = await createTestContext(new FakeGroupClient(groups));
    const output: string[] = [];

    const result = await runListGroupsCommand({
      context,
      stdout: (line) => output.push(line)
    });

    expect(result.groups).toEqual(groups);
    expect(JSON.parse(output[0] ?? "{}")).toEqual({
      event: "whatsapp.list_groups.completed",
      groups
    });
    await context.close();
  });

  it("runs db:migrate through a Nest application context", async () => {
    const output: string[] = [];

    const result = await runDbMigrateCommand({
      env,
      stdout: (line) => output.push(line)
    });

    expect(result.appliedCount).toBe(3);
    expect(JSON.parse(output[0] ?? "{}")).toEqual({
      event: "database.migrations.completed",
      appliedCount: 3
    });
  });

  it("starts the Nest process without network providers when disabled", async () => {
    const app = await startProcess({
      env,
      connectWhatsapp: false,
      installSignalHandlers: false
    });

    expect(app.get(RUN_BIRTHDAY_REMINDER_USE_CASE)).toBeDefined();
    await app.close();
  });
});

async function createTestContext(
  whatsappClient: WhatsAppGroupMessenger
): Promise<INestApplicationContext> {
  const previousEnv = applyEnv(env);
  try {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(WHATSAPP_CLIENT)
      .useValue(whatsappClient)
      .overrideProvider(BIRTHDAY_MESSAGE_GENERATOR)
      .useValue(new FakeMessageGenerator())
      .compile();
    await moduleRef.init();
    await moduleRef.get(DatabaseMigrationService).runMigrations();
    return moduleRef;
  } finally {
    restoreEnv(previousEnv);
  }
}

async function seedBirthdayPerson(context: INestApplicationContext): Promise<void> {
  await context.get(TypeOrmPersonRepository).create({
    id: "person-1",
    name: "Ana",
    birthDate: "1990-05-26",
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

class FakeMessageGenerator implements BirthdayMessageGenerator {
  async generate(input: BirthdayMessageInput) {
    return {
      message: `Parabens, ${input.person.name}!`,
      provider: "fallback" as const,
      model: null,
      fallbackReason: null
    };
  }
}

class FakeWhatsAppClient implements WhatsAppGroupMessenger {
  readonly sentMessages: Array<{ groupJid: string; text: string }> = [];
  connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async sendGroupMessage(groupJidValue: string, text: string) {
    this.sentMessages.push({ groupJid: groupJidValue, text });
    return {
      providerMessageId: `provider-${this.sentMessages.length}`,
      sentAt: now
    };
  }

  async listGroups(): Promise<WhatsAppGroup[]> {
    return [];
  }

  async close(): Promise<void> {
    return undefined;
  }
}

class FakeGroupClient extends FakeWhatsAppClient {
  constructor(private readonly groups: WhatsAppGroup[]) {
    super();
  }

  async listGroups(): Promise<WhatsAppGroup[]> {
    return this.groups;
  }
}
