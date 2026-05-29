import { describe, expect, it } from "vitest";
import {
  AddGroupTargetUseCase,
  ListAutomationTargetsUseCase,
  ListWhatsAppGroupsUseCase,
  RunAutomationUseCase,
  RunBirthdayAutomationUseCase,
  type AutomationRun,
  type AutomationRunInput,
  type AutomationRunRepositoryPort,
  type AutomationTargetLink,
  type AutomationWorkflow,
  type AutomationWorkflowRegistryPort,
  type DeliveryLogPort,
  type FinishAutomationRunInput,
  type MessageGeneratorPort,
  type PersonRepositoryPort,
  type RecordedDelivery,
  type StartAutomationRunInput,
  type TargetConfigurationPort,
  type WhatsAppGroup,
  type WhatsAppMessageSenderPort
} from "../../src/application/index.js";
import type { AutomationRunResult, Person, WhatsappTarget } from "../../src/domain/index.js";

const now = new Date("2026-05-27T02:30:00.000Z");

describe("RunAutomationUseCase", () => {
  it("starts and finishes an automation workflow", async () => {
    const runs = new FakeAutomationRunRepository();
    const workflow = new FakeAutomationWorkflow({
      itemsMatched: 1,
      deliveriesSent: 1,
      duplicateSkips: 0,
      failures: 0
    });
    const useCase = new RunAutomationUseCase({
      timezone: "America/Sao_Paulo",
      runs,
      workflows: new FakeAutomationWorkflowRegistry([workflow])
    });

    const result = await useCase.execute({
      automationKey: "birthdays.daily",
      trigger: "manual",
      now
    });

    expect(result.deliveriesSent).toBe(1);
    expect(runs.started[0]).toMatchObject({
      automationKey: "birthdays.daily",
      trigger: "manual",
      targetDate: "2026-05-26"
    });
    expect(runs.finished[0]).toMatchObject({
      status: "completed",
      deliveriesSent: 1
    });
    expect(workflow.inputs[0]).toMatchObject({
      runId: "run-1",
      automationKey: "birthdays.daily",
      trigger: "manual"
    });
  });
});

describe("RunBirthdayAutomationUseCase", () => {
  it("sends birthday messages and records deliveries", async () => {
    const context = createBirthdayUseCaseContext({
      people: [createPerson("person-1", "Ana")],
      targets: [createTarget("family@g.us")]
    });

    const result = await context.useCase.execute(createRunInput());

    expect(result).toEqual({
      itemsMatched: 1,
      deliveriesSent: 1,
      duplicateSkips: 0,
      failures: 0
    });
    expect(context.whatsapp.messages).toEqual([
      { targetJid: "family@g.us", text: "Parabens, Ana!" }
    ]);
    expect(context.deliveries.records[0]).toMatchObject({
      dedupeKey: "birthday:person-1:2026",
      status: "sent",
      targetJid: "family@g.us"
    });
  });

  it("skips duplicate deliveries before generating messages", async () => {
    const context = createBirthdayUseCaseContext({
      people: [createPerson("person-1", "Ana")],
      targets: [createTarget("family@g.us")],
      sentKeys: ["birthdays.daily:birthday:person-1:2026:family@g.us"]
    });

    const result = await context.useCase.execute(createRunInput());

    expect(result.duplicateSkips).toBe(1);
    expect(context.generator.calls).toBe(0);
    expect(context.whatsapp.messages).toEqual([]);
    expect(context.deliveries.records[0]).toMatchObject({
      status: "skipped",
      errorCode: "DUPLICATE_SUCCESSFUL_DELIVERY"
    });
  });

  it("records failures and continues processing", async () => {
    const context = createBirthdayUseCaseContext({
      people: [createPerson("person-1", "Ana"), createPerson("person-2", "Bruno")],
      targets: [createTarget("family@g.us")],
      generatorFailures: new Set(["person-1"])
    });

    const result = await context.useCase.execute(createRunInput());

    expect(result).toMatchObject({
      deliveriesSent: 1,
      failures: 1
    });
    expect(context.deliveries.records.map((record) => record.status)).toEqual(["failed", "sent"]);
    expect(context.whatsapp.messages).toEqual([
      { targetJid: "family@g.us", text: "Parabens, Bruno!" }
    ]);
  });
});

describe("target use cases", () => {
  it("delegates target commands to ports", async () => {
    const targets = new FakeTargetConfigurationPort();
    const groups = new FakeWhatsAppGroupsPort();

    await new AddGroupTargetUseCase(targets).execute({
      automationKey: "birthdays.daily",
      jid: "family@g.us",
      displayName: "Familia"
    });
    const listedTargets = await new ListAutomationTargetsUseCase(targets).execute(
      "birthdays.daily"
    );
    const listedGroups = await new ListWhatsAppGroupsUseCase(groups).execute();

    expect(targets.added[0]).toEqual({
      automationKey: "birthdays.daily",
      jid: "family@g.us",
      displayName: "Familia"
    });
    expect(listedTargets).toHaveLength(1);
    expect(listedGroups).toEqual([{ id: "family@g.us", subject: "Familia", participantCount: 3 }]);
  });
});

function createBirthdayUseCaseContext(input: {
  people: Person[];
  targets: WhatsappTarget[];
  sentKeys?: string[];
  generatorFailures?: Set<string>;
}) {
  const deliveries = new FakeDeliveryLogPort(input.sentKeys ?? []);
  const generator = new FakeMessageGeneratorPort(input.generatorFailures ?? new Set());
  const whatsapp = new FakeWhatsAppPort();
  const useCase = new RunBirthdayAutomationUseCase({
    automationKey: "birthdays.daily",
    timezone: "America/Sao_Paulo",
    people: new FakePersonRepositoryPort(input.people),
    targets: new FakeTargetResolverPort(input.targets),
    deliveries,
    whatsapp,
    messageGenerator: generator
  });
  return {
    useCase,
    deliveries,
    generator,
    whatsapp
  };
}

function createRunInput(): AutomationRunInput {
  return {
    runId: "run-1",
    automationKey: "birthdays.daily",
    trigger: "manual",
    now
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

function createTarget(jid: string): WhatsappTarget {
  return {
    id: jid,
    jid,
    displayName: jid,
    type: "group",
    active: true
  };
}

class FakeAutomationRunRepository implements AutomationRunRepositoryPort {
  readonly started: StartAutomationRunInput[] = [];
  readonly finished: FinishAutomationRunInput[] = [];

  async start(input: StartAutomationRunInput): Promise<AutomationRun> {
    this.started.push(input);
    return {
      id: "run-1",
      ...input
    };
  }

  async finish(_id: string, input: FinishAutomationRunInput): Promise<void> {
    this.finished.push(input);
  }
}

class FakeAutomationWorkflow implements AutomationWorkflow {
  readonly key = "birthdays.daily";
  readonly inputs: AutomationRunInput[] = [];

  constructor(private readonly result: AutomationRunResult) {}

  async run(input: AutomationRunInput): Promise<AutomationRunResult> {
    this.inputs.push(input);
    return this.result;
  }
}

class FakeAutomationWorkflowRegistry implements AutomationWorkflowRegistryPort {
  private readonly workflows = new Map<string, AutomationWorkflow>();

  constructor(workflows: AutomationWorkflow[]) {
    workflows.forEach((workflow) => this.workflows.set(workflow.key, workflow));
  }

  get(key: string): AutomationWorkflow {
    const workflow = this.workflows.get(key);
    if (workflow === undefined) {
      throw new Error(`Missing workflow ${key}`);
    }
    return workflow;
  }
}

class FakePersonRepositoryPort implements PersonRepositoryPort {
  constructor(private readonly people: Person[]) {}

  async findBirthdaysByMonthDay(month: number, day: number): Promise<Person[]> {
    const monthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return this.people.filter((person) => person.birthDate.endsWith(monthDay));
  }

  async findById(id: string): Promise<Person | null> {
    return this.people.find((person) => person.id === id) ?? null;
  }
}

class FakeTargetResolverPort {
  constructor(private readonly targets: WhatsappTarget[]) {}

  async findActiveTargets(): Promise<WhatsappTarget[]> {
    return this.targets;
  }
}

class FakeDeliveryLogPort implements DeliveryLogPort {
  readonly records: Array<Parameters<DeliveryLogPort["record"]>[0]> = [];
  private readonly sentKeys: Set<string>;

  constructor(sentKeys: string[]) {
    this.sentKeys = new Set(sentKeys);
  }

  async hasSent(input: Parameters<DeliveryLogPort["hasSent"]>[0]): Promise<boolean> {
    return this.sentKeys.has(
      createDeliveryKey(input.automationKey, input.dedupeKey, input.targetJid)
    );
  }

  async findPriorMessages(): Promise<string[]> {
    return [];
  }

  async record(input: Parameters<DeliveryLogPort["record"]>[0]): Promise<RecordedDelivery> {
    this.records.push(input);
    if (input.status === "sent") {
      this.sentKeys.add(createDeliveryKey(input.automationKey, input.dedupeKey, input.targetJid));
    }
    return {
      id: `delivery-${this.records.length}`,
      createdAt: now
    };
  }
}

class FakeMessageGeneratorPort implements MessageGeneratorPort {
  calls = 0;

  constructor(private readonly failures: Set<string>) {}

  async generate(input: Parameters<MessageGeneratorPort["generate"]>[0]) {
    this.calls += 1;
    if (this.failures.has(input.person.id)) {
      throw new Error("Generation failed.");
    }
    return {
      message: `Parabens, ${input.person.name}!`,
      provider: "fallback",
      model: null,
      fallbackReason: null,
      fallbackDetails: null
    };
  }
}

class FakeWhatsAppPort implements WhatsAppMessageSenderPort {
  readonly messages: Array<{ targetJid: string; text: string }> = [];

  async sendGroupMessage(targetJid: string, text: string) {
    this.messages.push({ targetJid, text });
    return {
      providerMessageId: `provider-${this.messages.length}`,
      sentAt: now
    };
  }

  onReady(): void {
    return undefined;
  }
}

class FakeTargetConfigurationPort implements TargetConfigurationPort {
  readonly added: Array<{ automationKey: string; jid: string; displayName?: string }> = [];
  private readonly links: AutomationTargetLink[] = [];

  async addGroupTarget(automationKey: string, jid: string, displayName?: string): Promise<void> {
    this.added.push({ automationKey, jid, displayName });
    this.links.push({
      id: "link-1",
      automationKey,
      targetId: "target-1",
      targetJid: jid,
      displayName: displayName ?? jid,
      active: true
    });
  }

  async listAutomationTargets(): Promise<AutomationTargetLink[]> {
    return this.links;
  }

  async findActiveTargets(): Promise<WhatsappTarget[]> {
    return [];
  }
}

class FakeWhatsAppGroupsPort {
  async listGroups(): Promise<WhatsAppGroup[]> {
    return [{ id: "family@g.us", subject: "Familia", participantCount: 3 }];
  }
}

function createDeliveryKey(automationKey: string, dedupeKey: string, targetJid: string): string {
  return `${automationKey}:${dedupeKey}:${targetJid}`;
}
