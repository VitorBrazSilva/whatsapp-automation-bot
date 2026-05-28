import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { BIRTHDAY_MESSAGE_GENERATOR } from "../ai/index.js";
import {
  DELIVERY_LOG,
  DuplicateMessageDeliveryError,
  type AutomationHandler,
  type AutomationRunInput,
  type AutomationRunResult,
  type DeliveryLog
} from "../automation/index.js";
import { AutomationRegistryService } from "../automation/index.js";
import { APP_CONFIG, type AppConfig } from "../config/index.js";
import { getLocalBirthdayDate, type Person } from "../domain/index.js";
import type { MessageGenerator, WhatsAppClient } from "../integrations/index.js";
import {
  METRICS_REGISTRY,
  STRUCTURED_LOGGER,
  readErrorCode,
  readErrorMessage,
  type MetricsRegistry,
  type StructuredLogger
} from "../observability/index.js";
import { TARGET_RESOLVER, type TargetResolver, type WhatsappTarget } from "../targets/index.js";
import { WHATSAPP_CLIENT } from "../whatsapp/index.js";
import { TypeOrmPersonRepository } from "./typeorm-person.repository.js";

export const BIRTHDAY_AUTOMATION_KEY = "birthdays.daily";

interface BirthdayProcessInput {
  run: AutomationRunInput;
  person: Person;
  target: WhatsappTarget;
  birthdayYear: number;
}

type ProcessResult = "sent" | "skipped" | "failed";

@Injectable()
export class BirthdayAutomationHandler implements AutomationHandler, OnModuleInit {
  readonly key = BIRTHDAY_AUTOMATION_KEY;
  private readonly deliveryLocks = new Map<string, Promise<void>>();

  constructor(
    @Inject(AutomationRegistryService)
    private readonly registry: AutomationRegistryService,
    @Inject(TypeOrmPersonRepository)
    private readonly people: TypeOrmPersonRepository,
    @Inject(TARGET_RESOLVER)
    private readonly targetResolver: TargetResolver,
    @Inject(DELIVERY_LOG)
    private readonly deliveryLog: DeliveryLog,
    @Inject(WHATSAPP_CLIENT)
    private readonly whatsappClient: WhatsAppClient,
    @Inject(BIRTHDAY_MESSAGE_GENERATOR)
    private readonly messageGenerator: MessageGenerator,
    @Inject(APP_CONFIG)
    private readonly config: AppConfig,
    @Inject(STRUCTURED_LOGGER)
    private readonly logger: StructuredLogger,
    @Inject(METRICS_REGISTRY)
    private readonly metrics: MetricsRegistry
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async run(input: AutomationRunInput): Promise<AutomationRunResult> {
    const localDate = getLocalBirthdayDate(input.now, this.config.timezone);
    const targets = await this.targetResolver.findActiveTargets(this.key);
    const people = await this.people.findBirthdaysByMonthDay(localDate.month, localDate.day);
    const result = createResult(people.length);
    this.metrics.incrementCounter("birthday_people_matched_total", {}, people.length);
    this.logger.info({
      event: "birthday.people_matched",
      automation: this.key,
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
    const alreadySent = await this.deliveryLog.hasSent(
      input.run.automationKey,
      dedupeKey,
      input.target.jid
    );
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
      const priorMessages = await this.deliveryLog.findSuccessfulMessages(
        input.run.automationKey,
        input.person.id,
        input.target.jid,
        5
      );
      const generated = await this.messageGenerator.generate({
        person: input.person,
        priorMessages,
        birthdayYear: input.birthdayYear
      });
      this.recordGeneratedMessage(input, generated.fallbackReason, generated.fallbackDetails);
      messageText = generated.message;
      const sendResult = await this.whatsappClient.sendGroupMessage(input.target.jid, messageText);
      await this.deliveryLog.record({
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
      if (error instanceof DuplicateMessageDeliveryError) {
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
    await this.deliveryLog.record({
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
    await this.deliveryLog.record({
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

function createBirthdayDedupeKey(personId: string, birthdayYear: number): string {
  return `birthday:${personId}:${birthdayYear}`;
}
