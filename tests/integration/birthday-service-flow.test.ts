import { describe, expect, it } from "vitest";
import { openSqliteDatabase, runMigrations, type SqliteDatabase } from "../../src/database/index.js";
import { DefaultBirthdayService } from "../../src/domain/index.js";
import type { Person } from "../../src/domain/index.js";
import type { MessageGenerator, SendResult, WhatsAppClient } from "../../src/integrations/index.js";
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
});

function createService(database: SqliteDatabase, whatsappClient: WhatsAppClient): DefaultBirthdayService {
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
      provider: "fallback" as const
    };
  }
}

class FakeWhatsAppClient implements WhatsAppClient {
  readonly sentMessages: Array<{ groupId: string; text: string }> = [];

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

  onReady(): void {
    return undefined;
  }
}

class DelayedWhatsAppClient extends FakeWhatsAppClient {
  override async sendGroupMessage(groupIdValue: string, text: string): Promise<SendResult> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return super.sendGroupMessage(groupIdValue, text);
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
