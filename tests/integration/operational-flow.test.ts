import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module.js";
import { BIRTHDAY_MESSAGE_GENERATOR } from "../../src/ai/index.js";
import { BirthdayAutomationService } from "../../src/birthday-automation/index.js";
import { runCheckTodayCommand } from "../../src/cli/check-today-command.js";
import { runDbMigrateCommand } from "../../src/cli/db-migrate-command.js";
import { runListGroupsCommand } from "../../src/cli/list-groups-command.js";
import { runTargetsAddCommand } from "../../src/cli/targets-add-command.js";
import { runTargetsListCommand } from "../../src/cli/targets-list-command.js";
import { DatabaseMigrationService } from "../../src/database/index.js";
import type { Person } from "../../src/domain/index.js";
import type {
  MessageGenerator,
  SendResult,
  WhatsAppClient,
  WhatsAppGroup
} from "../../src/integrations/index.js";
import { TypeOrmPersonRepository } from "../../src/birthday-automation/index.js";
import { TargetsService } from "../../src/targets/index.js";
import { WHATSAPP_CLIENT } from "../../src/whatsapp/index.js";
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
  OPENAI_API_KEY: "test-key",
  SCHEDULER_ENABLED: "false"
};

describe("operational flow", () => {
  it("runs the birthday automation through the Nest application context", async () => {
    const whatsapp = new FakeWhatsAppClient();
    const context = await createTestContext(whatsapp);
    await seedBirthdayPerson(context);
    await context.get(TargetsService).ensureLegacyBirthdayTarget();
    await context.get(TargetsService).addGroupTarget("birthdays.daily", "friends@g.us", "Friends");

    const result = await context.get(BirthdayAutomationService).runToday("manual", now);

    expect(result).toMatchObject({
      itemsMatched: 1,
      deliveriesSent: 2,
      duplicateSkips: 0,
      failures: 0
    });
    expect(whatsapp.sentMessages).toHaveLength(2);
    expect(whatsapp.sentMessages).toEqual(
      expect.arrayContaining([
        { groupId, text: "Parabens, Ana!" },
        { groupId: "friends@g.us", text: "Parabens, Ana!" }
      ])
    );
    await context.close();
  });

  it("runs birthdays:check-today with fake providers", async () => {
    const whatsapp = new FakeWhatsAppClient();
    const context = await createTestContext(whatsapp);
    const output: string[] = [];
    await seedBirthdayPerson(context);
    await context.get(TargetsService).ensureLegacyBirthdayTarget();

    const command = await runCheckTodayCommand({
      context,
      now,
      stdout: (line) => output.push(line)
    });

    expect(command.result).toMatchObject({
      itemsMatched: 1,
      deliveriesSent: 1,
      duplicateSkips: 0,
      failures: 0
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

  it("adds and lists targets through CLI commands", async () => {
    const context = await createTestContext(new FakeWhatsAppClient());
    const output: string[] = [];

    await runTargetsAddCommand({
      context,
      args: ["birthdays.daily", "friends@g.us", "Friends"],
      stdout: (line) => output.push(line)
    });
    const result = await runTargetsListCommand({
      context,
      args: ["birthdays.daily"],
      stdout: (line) => output.push(line)
    });

    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]).toMatchObject({
      automationKey: "birthdays.daily",
      targetJid: "friends@g.us",
      displayName: "Friends",
      active: true
    });
    await context.close();
  });

  it("runs db:migrate through a Nest application context", async () => {
    const output: string[] = [];

    const result = await runDbMigrateCommand({
      env,
      stdout: (line) => output.push(line)
    });

    expect(result.appliedCount).toBe(1);
    expect(JSON.parse(output[0] ?? "{}")).toEqual({
      event: "database.migrations.completed",
      appliedCount: 1
    });
  });

  it("starts the Nest process without network providers when disabled", async () => {
    const app = await startProcess({
      env,
      connectWhatsapp: false,
      listen: false,
      installSignalHandlers: false
    });

    expect(app.getHttpServer()).toBeDefined();
    await app.close();
  });
});

async function createTestContext(
  whatsappClient: WhatsAppClient | FakeGroupClient
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
}

class FakeGroupClient extends FakeWhatsAppClient {
  constructor(private readonly groups: WhatsAppGroup[]) {
    super();
  }

  async listGroups(): Promise<WhatsAppGroup[]> {
    return this.groups;
  }
}
