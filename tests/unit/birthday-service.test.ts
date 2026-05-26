import { describe, expect, it } from "vitest";
import {
  DefaultBirthdayService,
  getLocalBirthdayDate,
  type CheckTrigger
} from "../../src/domain/index.js";
import type { Person } from "../../src/domain/index.js";
import type { MessageGenerator, SendResult, WhatsAppClient } from "../../src/integrations/index.js";
import type {
  BirthdayCheck,
  BirthdayCheckRepository,
  DeliveryAttempt,
  DeliveryAttemptInput,
  DeliveryRepository,
  FinishBirthdayCheckInput,
  PersonRepository,
  StartBirthdayCheckInput
} from "../../src/repositories/index.js";

const groupId = "family-group@g.us";
const timezone = "America/Sao_Paulo";
const localBirthdayNow = new Date("2026-05-27T02:30:00.000Z");

describe("DefaultBirthdayService", () => {
  it("calculates the birthday date in the configured timezone", () => {
    expect(getLocalBirthdayDate(localBirthdayNow, timezone)).toEqual({
      year: 2026,
      month: 5,
      day: 26,
      checkDate: "2026-05-26"
    });
  });

  it("records a completed check when there are no birthdays", async () => {
    const context = createServiceContext({ people: [] });

    const result = await context.service.runDailyCheck({
      trigger: "scheduled",
      now: localBirthdayNow
    });

    expect(result).toMatchObject({
      trigger: "scheduled",
      birthdaysFound: 0,
      deliveriesSent: 0,
      duplicateSkips: 0,
      failures: 0
    });
    expect(context.checks.finished[0]).toMatchObject({
      status: "completed",
      birthdaysFound: 0
    });
  });

  it("sends one individual message for each birthday", async () => {
    const context = createServiceContext({
      people: [createPerson("person-1", "Ana"), createPerson("person-2", "Bruno")]
    });

    const result = await context.service.runDailyCheck({
      trigger: "manual",
      now: localBirthdayNow
    });

    expect(result).toMatchObject({
      birthdaysFound: 2,
      deliveriesSent: 2,
      duplicateSkips: 0,
      failures: 0
    });
    expect(context.whatsapp.sentMessages).toEqual([
      { groupId, text: "Parabens, Ana!" },
      { groupId, text: "Parabens, Bruno!" }
    ]);
    expect(context.deliveries.attempts.map((attempt) => attempt.status)).toEqual(["sent", "sent"]);
  });

  it("skips generation and sending when a successful delivery already exists", async () => {
    const context = createServiceContext({
      people: [createPerson("person-1", "Ana")],
      existingSuccessfulDeliveries: ["person-1:family-group@g.us:2026"]
    });

    const result = await context.service.runDailyCheck({
      trigger: "scheduled",
      now: localBirthdayNow
    });

    expect(result).toMatchObject({
      birthdaysFound: 1,
      deliveriesSent: 0,
      duplicateSkips: 1,
      failures: 0
    });
    expect(context.generator.calls).toBe(0);
    expect(context.whatsapp.sentMessages).toEqual([]);
    expect(context.deliveries.attempts[0]).toMatchObject({
      personId: "person-1",
      status: "skipped",
      errorCode: "DUPLICATE_SUCCESSFUL_DELIVERY"
    });
  });

  it("records generation failures and continues processing other birthdays", async () => {
    const context = createServiceContext({
      people: [createPerson("person-1", "Ana"), createPerson("person-2", "Bruno")],
      generatorFailures: new Set(["person-1"])
    });

    const result = await context.service.runDailyCheck({
      trigger: "scheduled",
      now: localBirthdayNow
    });

    expect(result).toMatchObject({
      birthdaysFound: 2,
      deliveriesSent: 1,
      duplicateSkips: 0,
      failures: 1
    });
    expect(context.deliveries.attempts.map((attempt) => attempt.status)).toEqual([
      "failed",
      "sent"
    ]);
    expect(context.whatsapp.sentMessages).toEqual([{ groupId, text: "Parabens, Bruno!" }]);
  });

  it("uses the recovery reason as the check trigger", async () => {
    const context = createServiceContext({ people: [] });

    const result = await context.service.runRecoveryCheck({
      reason: "whatsapp-reconnect",
      now: localBirthdayNow
    });

    expect(result.trigger).toBe("whatsapp-reconnect");
    expect(context.checks.started[0]?.trigger).toBe("whatsapp-reconnect");
  });
});

interface ServiceContext {
  service: DefaultBirthdayService;
  checks: FakeBirthdayCheckRepository;
  deliveries: FakeDeliveryRepository;
  generator: FakeMessageGenerator;
  whatsapp: FakeWhatsAppClient;
}

interface CreateContextInput {
  people: Person[];
  existingSuccessfulDeliveries?: string[];
  generatorFailures?: Set<string>;
}

function createServiceContext(input: CreateContextInput): ServiceContext {
  const people = new FakePersonRepository(input.people);
  const checks = new FakeBirthdayCheckRepository();
  const deliveries = new FakeDeliveryRepository(input.existingSuccessfulDeliveries ?? []);
  const generator = new FakeMessageGenerator(input.generatorFailures ?? new Set());
  const whatsapp = new FakeWhatsAppClient();
  const service = new DefaultBirthdayService({
    timezone,
    groupId,
    personRepository: people,
    birthdayCheckRepository: checks,
    deliveryRepository: deliveries,
    messageGenerator: generator,
    whatsappClient: whatsapp
  });
  return {
    service,
    checks,
    deliveries,
    generator,
    whatsapp
  };
}

class FakePersonRepository implements PersonRepository {
  constructor(private readonly people: Person[]) {}

  async create(): Promise<Person> {
    throw new Error("Not implemented.");
  }

  async findBirthdaysByMonthDay(month: number, day: number): Promise<Person[]> {
    return this.people.filter((person) => person.birthDate.endsWith(formatMonthDay(month, day)));
  }

  async findById(id: string): Promise<Person | null> {
    return this.people.find((person) => person.id === id) ?? null;
  }
}

class FakeBirthdayCheckRepository implements BirthdayCheckRepository {
  readonly started: StartBirthdayCheckInput[] = [];
  readonly finished: FinishBirthdayCheckInput[] = [];

  async startCheck(input: StartBirthdayCheckInput): Promise<BirthdayCheck> {
    this.started.push(input);
    return createBirthdayCheck(input.id ?? `check-${this.started.length}`, input.trigger);
  }

  async finishCheck(id: string, input: FinishBirthdayCheckInput): Promise<BirthdayCheck> {
    this.finished.push(input);
    return {
      ...createBirthdayCheck(id, this.started[0]?.trigger ?? "manual"),
      ...input,
      finishedAt: input.finishedAt ?? localBirthdayNow,
      errorMessage: input.errorMessage ?? null
    };
  }

  async findById(): Promise<BirthdayCheck | null> {
    return null;
  }
}

class FakeDeliveryRepository implements DeliveryRepository {
  readonly attempts: DeliveryAttemptInput[] = [];
  private readonly successfulDeliveries: Set<string>;

  constructor(existingSuccessfulDeliveries: string[]) {
    this.successfulDeliveries = new Set(existingSuccessfulDeliveries);
  }

  async hasSuccessfulDelivery(
    personId: string,
    groupIdValue: string,
    birthdayYear: number
  ): Promise<boolean> {
    return this.successfulDeliveries.has(createKey(personId, groupIdValue, birthdayYear));
  }

  async recordAttempt(input: DeliveryAttemptInput): Promise<DeliveryAttempt> {
    this.attempts.push(input);
    if (input.status === "sent") {
      this.successfulDeliveries.add(createKey(input.personId, input.groupId, input.birthdayYear));
    }
    return {
      id: `attempt-${this.attempts.length}`,
      createdAt: localBirthdayNow,
      ...input
    };
  }
}

class FakeMessageGenerator implements MessageGenerator {
  calls = 0;

  constructor(private readonly failures: Set<string>) {}

  async generate(input: Parameters<MessageGenerator["generate"]>[0]) {
    this.calls += 1;
    if (this.failures.has(input.person.id)) {
      throw new Error("Message generation failed.");
    }
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
      sentAt: localBirthdayNow
    };
  }

  onReady(): void {
    return undefined;
  }
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
    createdAt: localBirthdayNow,
    updatedAt: localBirthdayNow
  };
}

function createBirthdayCheck(id: string, trigger: CheckTrigger): BirthdayCheck {
  return {
    id,
    checkDate: "2026-05-26",
    timezone,
    trigger,
    status: "started",
    birthdaysFound: 0,
    deliveriesSent: 0,
    duplicateSkips: 0,
    failures: 0,
    startedAt: localBirthdayNow,
    finishedAt: null,
    errorMessage: null
  };
}

function formatMonthDay(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function createKey(personId: string, groupIdValue: string, birthdayYear: number): string {
  return `${personId}:${groupIdValue}:${birthdayYear}`;
}
