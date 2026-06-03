import { describe, expect, it } from "vitest";
import {
  RunBirthdayReminderUseCase,
  type BirthdayDeliveryRecord,
  type BirthdayDeliveryRepository,
  type BirthdayMessageGenerator,
  type GeneratedBirthdayMessage,
  type PersonRepository,
  type RecordedBirthdayDelivery,
  type WhatsAppGroup,
  type WhatsAppGroupMessenger
} from "../../src/application/index.js";
import type { BirthdayDeliveryKey, BirthdayMessageInput, Person } from "../../src/domain/index.js";

const now = new Date("2026-05-27T02:30:00.000Z");
const groupJid = "family@g.us";

describe("RunBirthdayReminderUseCase", () => {
  it("sends birthday messages to the configured group and records sent deliveries", async () => {
    const context = createUseCaseContext({
      people: [createPerson("person-1", "Ana")]
    });

    const result = await context.useCase.execute({ now, trigger: "manual" });

    expect(result).toEqual({
      peopleMatched: 1,
      sent: 1,
      skipped: 0,
      failed: 0
    });
    expect(context.whatsapp.messages).toEqual([{ groupJid, text: "Parabens, Ana!" }]);
    expect(context.deliveries.records[0]).toMatchObject({
      key: {
        personId: "person-1",
        groupJid,
        birthdayYear: 2026
      },
      status: "sent",
      provider: "fake",
      model: "fake-model"
    });
  });

  it("returns zero counters when no active birthday matches the local date", async () => {
    const context = createUseCaseContext({
      people: []
    });

    const result = await context.useCase.execute({ now, trigger: "scheduled" });

    expect(result).toEqual({
      peopleMatched: 0,
      sent: 0,
      skipped: 0,
      failed: 0
    });
    expect(context.generator.calls).toHaveLength(0);
  });

  it("skips duplicates before generating a message", async () => {
    const context = createUseCaseContext({
      people: [createPerson("person-1", "Ana")],
      sentKeys: ["person-1:family@g.us:2026"]
    });

    const result = await context.useCase.execute({ now, trigger: "manual" });

    expect(result.skipped).toBe(1);
    expect(context.generator.calls).toHaveLength(0);
    expect(context.whatsapp.messages).toEqual([]);
    expect(context.deliveries.records[0]).toMatchObject({
      status: "skipped",
      errorCode: "DUPLICATE_SUCCESSFUL_DELIVERY"
    });
  });

  it("records failures and continues with the next birthday", async () => {
    const context = createUseCaseContext({
      people: [createPerson("person-1", "Ana"), createPerson("person-2", "Bruno")],
      generatorFailures: new Set(["person-1"])
    });

    const result = await context.useCase.execute({ now, trigger: "manual" });

    expect(result).toMatchObject({
      peopleMatched: 2,
      sent: 1,
      failed: 1
    });
    expect(context.deliveries.records.map((record) => record.status)).toEqual(["failed", "sent"]);
    expect(context.whatsapp.messages).toEqual([{ groupJid, text: "Parabens, Bruno!" }]);
  });

  it("uses the configured timezone to find birthdays", async () => {
    const person = createPerson("person-1", "Ana");
    const context = createUseCaseContext({
      people: [person],
      timezone: "America/Sao_Paulo"
    });

    await context.useCase.execute({
      now: new Date("2026-05-27T02:30:00.000Z"),
      trigger: "startup"
    });

    expect(context.people.lookups).toEqual([{ month: 5, day: 26 }]);
  });
});

function createUseCaseContext(input: {
  people: Person[];
  timezone?: string;
  sentKeys?: string[];
  generatorFailures?: Set<string>;
}) {
  const people = new FakePersonRepository(input.people);
  const deliveries = new FakeBirthdayDeliveryRepository(input.sentKeys ?? []);
  const generator = new FakeBirthdayMessageGenerator(input.generatorFailures ?? new Set());
  const whatsapp = new FakeWhatsAppGroupMessenger();
  const useCase = new RunBirthdayReminderUseCase({
    timezone: input.timezone ?? "America/Sao_Paulo",
    groupJid,
    people,
    deliveries,
    messageGenerator: generator,
    whatsapp
  });
  return {
    useCase,
    people,
    deliveries,
    generator,
    whatsapp
  };
}

function createPerson(id: string, name: string): Person {
  return {
    id,
    name,
    nickname: null,
    birthDate: "1990-05-26",
    relationship: null,
    profession: null,
    hobbies: null,
    traits: null,
    messageStyle: null,
    notes: null,
    active: true,
    createdAt: now,
    updatedAt: now
  };
}

class FakePersonRepository implements PersonRepository {
  readonly lookups: Array<{ month: number; day: number }> = [];

  constructor(private readonly people: Person[]) {}

  async findActiveByBirthday(month: number, day: number): Promise<Person[]> {
    this.lookups.push({ month, day });
    const monthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return this.people.filter((person) => person.active && person.birthDate.endsWith(monthDay));
  }
}

class FakeBirthdayDeliveryRepository implements BirthdayDeliveryRepository {
  readonly records: BirthdayDeliveryRecord[] = [];
  private readonly sentKeys: Set<string>;

  constructor(sentKeys: string[]) {
    this.sentKeys = new Set(sentKeys);
  }

  async hasSent(input: BirthdayDeliveryKey): Promise<boolean> {
    return this.sentKeys.has(formatKey(input));
  }

  async findRecentMessages(): Promise<string[]> {
    return [];
  }

  async record(input: BirthdayDeliveryRecord): Promise<RecordedBirthdayDelivery> {
    this.records.push(input);
    if (input.status === "sent") {
      this.sentKeys.add(formatKey(input.key));
    }
    return {
      id: `delivery-${this.records.length}`,
      createdAt: now
    };
  }
}

class FakeBirthdayMessageGenerator implements BirthdayMessageGenerator {
  readonly calls: BirthdayMessageInput[] = [];

  constructor(private readonly failures: Set<string>) {}

  async generate(input: BirthdayMessageInput): Promise<GeneratedBirthdayMessage> {
    this.calls.push(input);
    if (this.failures.has(input.person.id)) {
      throw new Error("Generation failed.");
    }
    return {
      message: `Parabens, ${input.person.name}!`,
      provider: "fake",
      model: "fake-model",
      fallbackReason: null
    };
  }
}

class FakeWhatsAppGroupMessenger implements WhatsAppGroupMessenger {
  readonly messages: Array<{ groupJid: string; text: string }> = [];

  async connect(): Promise<void> {
    return undefined;
  }

  async sendGroupMessage(targetGroupJid: string, text: string) {
    this.messages.push({ groupJid: targetGroupJid, text });
    return {
      providerMessageId: `provider-${this.messages.length}`,
      sentAt: now
    };
  }

  async listGroups(): Promise<WhatsAppGroup[]> {
    return [{ id: groupJid, subject: "Familia", participantCount: 3 }];
  }

  async close(): Promise<void> {
    return undefined;
  }
}

function formatKey(input: BirthdayDeliveryKey): string {
  return `${input.personId}:${input.groupJid}:${input.birthdayYear}`;
}
