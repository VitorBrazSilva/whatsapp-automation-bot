import { describe, expect, it } from "vitest";
import {
  openSqliteDatabase,
  runMigrations,
  type SqliteDatabase
} from "../../src/database/index.js";
import { DefaultBirthdayService } from "../../src/domain/index.js";
import type { Person } from "../../src/domain/index.js";
import {
  OpenAiMessageGenerator,
  type MessageGenerator,
  type OpenAiCreateResponseRequest,
  type OpenAiCreateResponseResult,
  type OpenAiResponsesClient,
  type SendResult,
  type WhatsAppClient
} from "../../src/integrations/index.js";
import {
  SqliteBirthdayCheckRepository,
  SqliteDeliveryRepository,
  SqlitePersonRepository
} from "../../src/repositories/index.js";

const groupId = "family-group@g.us";
const timezone = "America/Sao_Paulo";
const checkNow = new Date("2026-05-26T12:00:00.000Z");

describe("BirthdayService integration flow", () => {
  it("runs the full birthday flow with SQLite and no network providers", async () => {
    const database = await createMigratedDatabase();
    const people = new SqlitePersonRepository(database, fixedClock);
    await people.create({
      id: "person-1",
      name: "Ana",
      birthDate: "1990-05-26"
    });
    await people.create({
      id: "person-2",
      name: "Bruno",
      birthDate: "1990-05-26"
    });

    const whatsapp = new FakeWhatsAppClient();
    const service = createService(database, whatsapp);
    const result = await service.runDailyCheck({ trigger: "scheduled", now: checkNow });

    expect(result).toMatchObject({
      birthdaysFound: 2,
      deliveriesSent: 2,
      duplicateSkips: 0,
      failures: 0
    });
    expect(whatsapp.sentMessages.map((message) => message.text)).toEqual([
      "Parabens, Ana!",
      "Parabens, Bruno!"
    ]);
    expect(readAttempts(database)).toEqual([
      { person_id: "person-1", status: "sent" },
      { person_id: "person-2", status: "sent" }
    ]);
    database.close();
  });

  it("does not send twice for concurrent checks in the same process", async () => {
    const database = await createMigratedDatabase();
    const people = new SqlitePersonRepository(database, fixedClock);
    await people.create({
      id: "person-1",
      name: "Ana",
      birthDate: "1990-05-26"
    });

    const whatsapp = new DelayedWhatsAppClient();
    const service = createService(database, whatsapp);
    const checks = await Promise.all([
      service.runDailyCheck({ trigger: "manual", now: checkNow }),
      service.runRecoveryCheck({ reason: "startup", now: checkNow })
    ]);

    expect(checks.reduce((total, check) => total + check.deliveriesSent, 0)).toBe(1);
    expect(checks.reduce((total, check) => total + check.duplicateSkips, 0)).toBe(1);
    expect(whatsapp.sentMessages).toHaveLength(1);
    expect(readAttempts(database)).toEqual([
      { person_id: "person-1", status: "sent" },
      { person_id: "person-1", status: "skipped" }
    ]);
    database.close();
  });

  it("uses WhatsApp ready events for recovery without duplicate sends", async () => {
    const database = await createMigratedDatabase();
    const people = new SqlitePersonRepository(database, fixedClock);
    await people.create({
      id: "person-1",
      name: "Ana",
      birthDate: "1990-05-26"
    });

    const whatsapp = new FakeWhatsAppClient();
    const service = createService(database, whatsapp);
    const recoveryResults: unknown[] = [];
    whatsapp.onReady(async () => {
      recoveryResults.push(
        await service.runRecoveryCheck({ reason: "whatsapp-reconnect", now: checkNow })
      );
    });

    await whatsapp.emitReady();
    await whatsapp.emitReady();

    expect(whatsapp.sentMessages).toEqual([{ groupId, text: "Parabens, Ana!" }]);
    expect(recoveryResults).toHaveLength(2);
    expect(readAttempts(database)).toEqual([
      { person_id: "person-1", status: "sent" },
      { person_id: "person-1", status: "skipped" }
    ]);
    database.close();
  });

  it("runs the BirthdayService flow with the OpenAI generator and a mocked client", async () => {
    const database = await createMigratedDatabase();
    const people = new SqlitePersonRepository(database, fixedClock);
    const checks = new SqliteBirthdayCheckRepository(database, fixedClock);
    const deliveries = new SqliteDeliveryRepository(database, fixedClock);
    await people.create({
      id: "person-1",
      name: "Ana",
      birthDate: "1990-05-26"
    });
    await checks.startCheck({
      id: "history-check",
      checkDate: "2025-05-26",
      timezone,
      trigger: "manual"
    });
    await deliveries.recordAttempt({
      personId: "person-1",
      groupId,
      birthdayYear: 2025,
      checkId: "history-check",
      messageText: "Mensagem enviada no ano passado.",
      status: "sent",
      providerMessageId: "provider-history",
      errorCode: null,
      errorMessage: null
    });

    const openAi = new FakeOpenAiClient({
      output_text: JSON.stringify({ message: "Feliz aniversario, Ana! Que seja um dia lindo." })
    });
    const whatsapp = new FakeWhatsAppClient();
    const service = new DefaultBirthdayService({
      timezone,
      groupId,
      personRepository: people,
      birthdayCheckRepository: checks,
      deliveryRepository: deliveries,
      messageGenerator: new OpenAiMessageGenerator({
        model: "gpt-4.1-mini",
        timeoutMs: 100,
        client: openAi
      }),
      whatsappClient: whatsapp
    });

    const result = await service.runDailyCheck({ trigger: "scheduled", now: checkNow });

    expect(result).toMatchObject({
      birthdaysFound: 1,
      deliveriesSent: 1,
      failures: 0
    });
    expect(whatsapp.sentMessages).toEqual([
      { groupId, text: "Feliz aniversario, Ana! Que seja um dia lindo." }
    ]);
    const payload = JSON.parse(openAi.requests[0]?.input[0]?.content[0]?.text ?? "{}") as {
      priorMessages: string[];
    };
    expect(payload.priorMessages).toEqual(["Mensagem enviada no ano passado."]);
    database.close();
  });
});

function createService(
  database: SqliteDatabase,
  whatsappClient: WhatsAppClient
): DefaultBirthdayService {
  return new DefaultBirthdayService({
    timezone,
    groupId,
    personRepository: new SqlitePersonRepository(database, fixedClock),
    birthdayCheckRepository: new SqliteBirthdayCheckRepository(database, fixedClock),
    deliveryRepository: new SqliteDeliveryRepository(database, fixedClock),
    messageGenerator: new FakeMessageGenerator(),
    whatsappClient
  });
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

  async connect(): Promise<void> {
    return undefined;
  }

  async sendGroupMessage(groupIdValue: string, text: string): Promise<SendResult> {
    this.sentMessages.push({ groupId: groupIdValue, text });
    return {
      providerMessageId: `provider-${this.sentMessages.length}`,
      sentAt: checkNow
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
}

class DelayedWhatsAppClient extends FakeWhatsAppClient {
  override async sendGroupMessage(groupIdValue: string, text: string): Promise<SendResult> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return super.sendGroupMessage(groupIdValue, text);
  }
}

class FakeOpenAiClient implements OpenAiResponsesClient {
  readonly requests: OpenAiCreateResponseRequest[] = [];

  constructor(private readonly response: OpenAiCreateResponseResult) {}

  async createResponse(
    input: OpenAiCreateResponseRequest,
    signal: AbortSignal
  ): Promise<OpenAiCreateResponseResult> {
    void signal;
    this.requests.push(input);
    return this.response;
  }
}

async function createMigratedDatabase(): Promise<SqliteDatabase> {
  const database = await openSqliteDatabase({ path: ":memory:" });
  await runMigrations(database);
  return database;
}

function readAttempts(database: SqliteDatabase): Array<{ person_id: unknown; status: unknown }> {
  return database.all(
    `
      SELECT person_id, status
      FROM delivery_attempts
      ORDER BY created_at ASC, status ASC
    `
  );
}

function fixedClock(): Date {
  return checkNow;
}
