import { describe, expect, it } from "vitest";
import {
  openSqliteDatabase,
  runMigrations,
  type SqliteDatabase
} from "../../src/database/index.js";
import {
  DuplicateSuccessfulDeliveryError,
  SqliteBirthdayCheckRepository,
  SqliteDeliveryRepository,
  SqlitePersonRepository
} from "../../src/repositories/index.js";

describe("SQLite repositories", () => {
  it("finds active birthdays by month/day and reads people by id", async () => {
    const database = await createMigratedDatabase();
    const people = new SqlitePersonRepository(database, fixedClock);

    await people.create({
      id: "person-1",
      name: "Ana",
      birthDate: "1990-05-26",
      nickname: "Aninha",
      relationship: "prima"
    });
    await people.create({
      id: "person-2",
      name: "Bruno",
      birthDate: "1988-05-26",
      active: false
    });
    await people.create({
      id: "person-3",
      name: "Carla",
      birthDate: "1991-05-27"
    });

    const birthdays = await people.findBirthdaysByMonthDay(5, 26);
    expect(birthdays.map((person) => person.id)).toEqual(["person-1"]);
    expect(birthdays[0]).toMatchObject({
      name: "Ana",
      nickname: "Aninha",
      relationship: "prima",
      active: true
    });
    await expect(people.findById("missing")).resolves.toBeNull();

    database.close();
  });

  it("records birthday checks even when no birthdays are found", async () => {
    const database = await createMigratedDatabase();
    const checks = new SqliteBirthdayCheckRepository(database, fixedClock);

    const started = await checks.startCheck({
      id: "check-1",
      checkDate: "2026-05-26",
      timezone: "America/Sao_Paulo",
      trigger: "manual"
    });
    expect(started).toMatchObject({
      id: "check-1",
      status: "started",
      birthdaysFound: 0
    });

    const finished = await checks.finishCheck("check-1", {
      status: "completed",
      birthdaysFound: 0,
      deliveriesSent: 0,
      duplicateSkips: 0,
      failures: 0
    });

    expect(finished).toMatchObject({
      id: "check-1",
      status: "completed",
      birthdaysFound: 0,
      deliveriesSent: 0,
      duplicateSkips: 0,
      failures: 0,
      errorMessage: null
    });
    expect(finished.finishedAt).toEqual(fixedClock());

    database.close();
  });

  it("records attempts and blocks duplicate successful deliveries", async () => {
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
      id: "check-1",
      checkDate: "2026-05-26",
      timezone: "America/Sao_Paulo",
      trigger: "scheduled"
    });

    await deliveries.recordAttempt({
      personId: "person-1",
      groupId: "family-group@g.us",
      birthdayYear: 2026,
      checkId: "check-1",
      messageText: "Falha temporaria",
      status: "failed",
      providerMessageId: null,
      errorCode: "WA_DISCONNECTED",
      errorMessage: "WhatsApp disconnected"
    });

    const sent = await deliveries.recordAttempt({
      personId: "person-1",
      groupId: "family-group@g.us",
      birthdayYear: 2026,
      checkId: "check-1",
      messageText: "Parabens, Ana!",
      status: "sent",
      providerMessageId: "provider-1",
      errorCode: null,
      errorMessage: null
    });

    expect(sent).toMatchObject({
      personId: "person-1",
      status: "sent",
      providerMessageId: "provider-1"
    });
    await expect(
      deliveries.findSuccessfulMessagesByPerson("person-1", "family-group@g.us", 5)
    ).resolves.toEqual(["Parabens, Ana!"]);
    await expect(
      deliveries.hasSuccessfulDelivery("person-1", "family-group@g.us", 2026)
    ).resolves.toBe(true);

    await expect(
      deliveries.recordAttempt({
        personId: "person-1",
        groupId: "family-group@g.us",
        birthdayYear: 2026,
        checkId: "check-1",
        messageText: "Parabens duplicado",
        status: "sent",
        providerMessageId: "provider-2",
        errorCode: null,
        errorMessage: null
      })
    ).rejects.toBeInstanceOf(DuplicateSuccessfulDeliveryError);

    database.close();
  });
});

async function createMigratedDatabase(): Promise<SqliteDatabase> {
  const database = await openSqliteDatabase({ path: ":memory:" });
  await runMigrations(database);
  return database;
}

function fixedClock(): Date {
  return new Date("2026-05-26T12:00:00.000Z");
}
