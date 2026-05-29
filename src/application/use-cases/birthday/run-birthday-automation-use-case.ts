import {
  createBirthdayDedupeKey,
  getLocalBirthdayDate,
  type AutomationRunResult,
  type Person,
  type WhatsappTarget
} from "../../../domain/index.js";
import {
  nullLoggerPort,
  nullMetricsPort,
  type AutomationRunInput,
  type DeliveryLogPort,
  type LoggerPort,
  type MessageGeneratorPort,
  type MetricsPort,
  type PersonRepositoryPort,
  type RunBirthdayAutomationUseCasePort,
  type TargetResolverPort,
  type WhatsAppMessageSenderPort
} from "../../ports/index.js";

export interface RunBirthdayAutomationUseCaseOptions {
  automationKey: string;
  timezone: string;
  people: PersonRepositoryPort;
  targets: TargetResolverPort;
  deliveries: DeliveryLogPort;
  whatsapp: WhatsAppMessageSenderPort;
  messageGenerator: MessageGeneratorPort;
  logger?: LoggerPort;
  metrics?: MetricsPort;
}

interface BirthdayProcessInput {
  run: AutomationRunInput;
  person: Person;
  target: WhatsappTarget;
  birthdayYear: number;
}

type ProcessResult = "sent" | "skipped" | "failed";

export class RunBirthdayAutomationUseCase implements RunBirthdayAutomationUseCasePort {
  private readonly automationKey: string;
  private readonly timezone: string;
  private readonly people: PersonRepositoryPort;
  private readonly targets: TargetResolverPort;
  private readonly deliveries: DeliveryLogPort;
  private readonly whatsapp: WhatsAppMessageSenderPort;
  private readonly messageGenerator: MessageGeneratorPort;
  private readonly logger: LoggerPort;
  private readonly metrics: MetricsPort;
  private readonly deliveryLocks = new Map<string, Promise<void>>();

  constructor(options: RunBirthdayAutomationUseCaseOptions) {
    this.automationKey = options.automationKey;
    this.timezone = options.timezone;
    this.people = options.people;
    this.targets = options.targets;
    this.deliveries = options.deliveries;
    this.whatsapp = options.whatsapp;
    this.messageGenerator = options.messageGenerator;
    this.logger = options.logger ?? nullLoggerPort;
    this.metrics = options.metrics ?? nullMetricsPort;
  }

  async execute(input: AutomationRunInput): Promise<AutomationRunResult> {
    const localDate = getLocalBirthdayDate(input.now, this.timezone);
    const targets = await this.targets.findActiveTargets(this.automationKey);
    const people = await this.people.findBirthdaysByMonthDay(localDate.month, localDate.day);
    const result = createResult(people.length);
    this.metrics.incrementCounter("birthday_people_matched_total", {}, people.length);
    this.logger.info({
      event: "birthday.people_matched",
      automation: this.automationKey,
      runId: input.runId,
      targetDate: localDate.checkDate,
      peopleMatched: people.length,
      targetCount: targets.length
    });
    for (const person of people) {
      for (const target of targets) {
        applyProcessResult(
          result,
          await this.processBirthday({
            run: input,
            person,
            target,
            birthdayYear: localDate.year
          })
        );
      }
    }
    return result;
  }

  private async processBirthday(input: BirthdayProcessInput): Promise<ProcessResult> {
    const dedupeKey = createBirthdayDedupeKey(input.person.id, input.birthdayYear);
    const lockKey = `${dedupeKey}:${input.target.jid}`;
    return this.withDeliveryLock(lockKey, () => this.processBirthdayWithLock(input, dedupeKey));
  }

  private async processBirthdayWithLock(
    input: BirthdayProcessInput,
    dedupeKey: string
  ): Promise<ProcessResult> {
    const alreadySent = await this.deliveries.hasSent({
      automationKey: input.run.automationKey,
      dedupeKey,
      targetJid: input.target.jid
    });
    if (alreadySent) {
      await this.recordSkippedDelivery(input, dedupeKey);
      this.recordDeliverySkipped(input, dedupeKey);
      return "skipped";
    }
    return this.generateAndSendMessage(input, dedupeKey);
  }

  private async generateAndSendMessage(
    input: BirthdayProcessInput,
    dedupeKey: string
  ): Promise<ProcessResult> {
    let messageText = "";
    try {
      const priorMessages = await this.deliveries.findPriorMessages({
        automationKey: input.run.automationKey,
        subjectRef: input.person.id,
        targetJid: input.target.jid,
        limit: 5
      });
      const generated = await this.messageGenerator.generate({
        person: input.person,
        priorMessages,
        birthdayYear: input.birthdayYear
      });
      this.recordGeneratedMessage(input, generated.fallbackReason, generated.fallbackDetails);
      messageText = generated.message;
      const sendResult = await this.whatsapp.sendGroupMessage(input.target.jid, messageText);
      await this.deliveries.record({
        automationRunId: input.run.runId,
        automationKey: input.run.automationKey,
        targetJid: input.target.jid,
        dedupeKey,
        subjectRef: input.person.id,
        messageText,
        status: "sent",
        providerMessageId: sendResult.providerMessageId,
        errorCode: null,
        errorMessage: null
      });
      this.recordDeliverySent(input);
      return "sent";
    } catch (error) {
      if (isDuplicateMessageDeliveryError(error)) {
        await this.recordSkippedDelivery(input, dedupeKey);
        this.recordDeliverySkipped(input, dedupeKey);
        return "skipped";
      }
      await this.recordFailedDelivery(input, dedupeKey, messageText, error);
      this.recordDeliveryFailed(input, error);
      return "failed";
    }
  }

  private async recordSkippedDelivery(
    input: BirthdayProcessInput,
    dedupeKey: string
  ): Promise<void> {
    await this.deliveries.record({
      automationRunId: input.run.runId,
      automationKey: input.run.automationKey,
      targetJid: input.target.jid,
      dedupeKey,
      subjectRef: input.person.id,
      messageText: "Skipped because a successful delivery already exists.",
      status: "skipped",
      providerMessageId: null,
      errorCode: "DUPLICATE_SUCCESSFUL_DELIVERY",
      errorMessage: null
    });
  }

  private async recordFailedDelivery(
    input: BirthdayProcessInput,
    dedupeKey: string,
    messageText: string,
    error: unknown
  ): Promise<void> {
    await this.deliveries.record({
      automationRunId: input.run.runId,
      automationKey: input.run.automationKey,
      targetJid: input.target.jid,
      dedupeKey,
      subjectRef: input.person.id,
      messageText,
      status: "failed",
      providerMessageId: null,
      errorCode: readErrorCode(error),
      errorMessage: readErrorMessage(error)
    });
  }

  private recordGeneratedMessage(
    input: BirthdayProcessInput,
    fallbackReason: string | null,
    fallbackDetails: {
      status: number | null;
      statusText: string | null;
      requestId: string | null;
    } | null
  ): void {
    if (fallbackReason === null) {
      return;
    }
    this.metrics.incrementCounter("message_generation_fallbacks_total", {
      automation: input.run.automationKey,
      reason: fallbackReason
    });
    this.logger.warn({
      event: "message.generation.fallback",
      automation: input.run.automationKey,
      runId: input.run.runId,
      subjectRef: input.person.id,
      reason: fallbackReason,
      openAiStatus: fallbackDetails?.status ?? null,
      openAiStatusText: fallbackDetails?.statusText ?? null,
      openAiRequestId: fallbackDetails?.requestId ?? null
    });
  }

  private recordDeliverySent(input: BirthdayProcessInput): void {
    this.metrics.incrementCounter("message_deliveries_total", {
      automation: input.run.automationKey,
      status: "sent"
    });
    this.logger.info({
      event: "message.delivery.sent",
      automation: input.run.automationKey,
      runId: input.run.runId,
      subjectRef: input.person.id,
      targetJid: input.target.jid
    });
  }

  private recordDeliverySkipped(input: BirthdayProcessInput, dedupeKey: string): void {
    this.metrics.incrementCounter("message_deliveries_total", {
      automation: input.run.automationKey,
      status: "skipped"
    });
    this.metrics.incrementCounter("message_delivery_duplicates_total", {
      automation: input.run.automationKey
    });
    this.logger.warn({
      event: "message.delivery.skipped",
      automation: input.run.automationKey,
      runId: input.run.runId,
      subjectRef: input.person.id,
      targetJid: input.target.jid,
      dedupeKey
    });
  }

  private recordDeliveryFailed(input: BirthdayProcessInput, error: unknown): void {
    this.metrics.incrementCounter("message_deliveries_total", {
      automation: input.run.automationKey,
      status: "failed"
    });
    this.logger.error({
      event: "message.delivery.failed",
      automation: input.run.automationKey,
      runId: input.run.runId,
      subjectRef: input.person.id,
      targetJid: input.target.jid,
      errorCode: readErrorCode(error),
      errorMessage: readErrorMessage(error)
    });
  }

  private async withDeliveryLock<T>(key: string, callback: () => Promise<T>): Promise<T> {
    const previousLock = this.deliveryLocks.get(key) ?? Promise.resolve();
    let releaseLock: () => void = () => undefined;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const queuedLock = previousLock.then(() => currentLock);
    this.deliveryLocks.set(key, queuedLock);
    await previousLock;
    try {
      return await callback();
    } finally {
      releaseLock();
      if (this.deliveryLocks.get(key) === queuedLock) {
        this.deliveryLocks.delete(key);
      }
    }
  }
}

function createResult(itemsMatched: number): AutomationRunResult {
  return {
    itemsMatched,
    deliveriesSent: 0,
    duplicateSkips: 0,
    failures: 0
  };
}

function applyProcessResult(result: AutomationRunResult, processResult: ProcessResult): void {
  if (processResult === "sent") {
    result.deliveriesSent += 1;
    return;
  }
  if (processResult === "skipped") {
    result.duplicateSkips += 1;
    return;
  }
  result.failures += 1;
}

function readErrorCode(error: unknown): string {
  if (isCodeError(error)) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "UNKNOWN_ERROR";
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/\s+/g, " ").trim();
  }
  return "Unknown error.";
}

function isCodeError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
  );
}

function isDuplicateMessageDeliveryError(error: unknown): boolean {
  return error instanceof Error && error.name === "DuplicateMessageDeliveryError";
}
