import {
  createBirthdayDedupeKey,
  getLocalBirthdayDate,
  type CheckTrigger,
  type Person,
  type RecoveryReason
} from "../../domain/index.js";

export type { CheckTrigger, RecoveryReason } from "../../domain/index.js";

export interface CheckInput {
  trigger: CheckTrigger;
  now: Date;
}

export interface RecoveryCheckInput {
  reason: RecoveryReason;
  now: Date;
}

export interface CheckResult {
  trigger: CheckTrigger;
  processedAt: Date;
  birthdaysFound: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
}

export interface BirthdayService {
  runDailyCheck(input: CheckInput): Promise<CheckResult>;
  runRecoveryCheck(input: RecoveryCheckInput): Promise<CheckResult>;
}

export interface BirthdayMessageInput {
  person: Person;
  priorMessages: string[];
  birthdayYear?: number;
}

export interface GeneratedMessage {
  message: string;
  provider: string;
  model: string | null;
  fallbackReason: string | null;
  fallbackDetails: {
    status: number | null;
    statusText: string | null;
    requestId: string | null;
  } | null;
}

export interface MessageGenerator {
  generate(input: BirthdayMessageInput): Promise<GeneratedMessage>;
}

export interface SendResult {
  providerMessageId: string | null;
  sentAt: Date;
}

export interface WhatsAppClient {
  connect(): Promise<void>;
  sendGroupMessage(groupId: string, text: string): Promise<SendResult>;
  onReady(handler: () => Promise<void>): void;
}

export interface PersonRepository {
  findBirthdaysByMonthDay(month: number, day: number): Promise<Person[]>;
  findById(id: string): Promise<Person | null>;
}

export type BirthdayCheckStatus = "started" | "completed" | "failed";

export interface BirthdayCheck {
  id: string;
  checkDate: string;
  timezone: string;
  trigger: CheckTrigger;
  status: BirthdayCheckStatus;
  birthdaysFound: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
}

export interface StartBirthdayCheckInput {
  id?: string;
  checkDate: string;
  timezone: string;
  trigger: CheckTrigger;
  startedAt?: Date;
}

export interface FinishBirthdayCheckInput {
  status: Exclude<BirthdayCheckStatus, "started">;
  birthdaysFound: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
  finishedAt?: Date;
  errorMessage?: string | null;
}

export interface BirthdayCheckRepository {
  startCheck(input: StartBirthdayCheckInput): Promise<BirthdayCheck>;
  finishCheck(id: string, input: FinishBirthdayCheckInput): Promise<BirthdayCheck>;
  findById(id: string): Promise<BirthdayCheck | null>;
}

export type DeliveryStatus = "sent" | "failed" | "skipped";

export interface DeliveryAttemptInput {
  personId: string;
  groupId: string;
  birthdayYear: number;
  checkId: string;
  messageText: string;
  status: DeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface DeliveryAttempt extends DeliveryAttemptInput {
  id: string;
  createdAt: Date;
}

export interface DeliveryRepository {
  hasSuccessfulDelivery(personId: string, groupId: string, birthdayYear: number): Promise<boolean>;
  findSuccessfulMessagesByPerson(
    personId: string,
    groupId: string,
    limit: number
  ): Promise<string[]>;
  recordAttempt(input: DeliveryAttemptInput): Promise<DeliveryAttempt>;
}

export interface StructuredLogger {
  info(fields: Record<string, unknown>): void;
  warn(fields: Record<string, unknown>): void;
  error(fields: Record<string, unknown>): void;
}

export interface MetricsRegistry {
  incrementCounter(name: string, labels?: Record<string, string>, value?: number): void;
}

export interface CreateBirthdayServiceOptions {
  timezone: string;
  groupId: string;
  personRepository: PersonRepository;
  birthdayCheckRepository: BirthdayCheckRepository;
  deliveryRepository: DeliveryRepository;
  messageGenerator: MessageGenerator;
  whatsappClient: WhatsAppClient;
  logger?: StructuredLogger;
  metrics?: MetricsRegistry;
}

interface CheckCounters {
  birthdaysFound: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
}

interface ProcessBirthdayInput {
  person: Person;
  checkId: string;
  birthdayYear: number;
}

export class DefaultBirthdayService implements BirthdayService {
  private readonly timezone: string;
  private readonly groupId: string;
  private readonly personRepository: PersonRepository;
  private readonly birthdayCheckRepository: BirthdayCheckRepository;
  private readonly deliveryRepository: DeliveryRepository;
  private readonly messageGenerator: MessageGenerator;
  private readonly whatsappClient: WhatsAppClient;
  private readonly logger: StructuredLogger;
  private readonly metrics: MetricsRegistry;
  private readonly deliveryLocks = new Map<string, Promise<void>>();

  constructor(options: CreateBirthdayServiceOptions) {
    this.timezone = options.timezone;
    this.groupId = options.groupId;
    this.personRepository = options.personRepository;
    this.birthdayCheckRepository = options.birthdayCheckRepository;
    this.deliveryRepository = options.deliveryRepository;
    this.messageGenerator = options.messageGenerator;
    this.whatsappClient = options.whatsappClient;
    this.logger = options.logger ?? nullLogger;
    this.metrics = options.metrics ?? nullMetricsRegistry;
  }

  async runDailyCheck(input: CheckInput): Promise<CheckResult> {
    return this.runCheck(input.trigger, input.now);
  }

  async runRecoveryCheck(input: RecoveryCheckInput): Promise<CheckResult> {
    return this.runCheck(input.reason, input.now);
  }

  private async runCheck(trigger: CheckTrigger, now: Date): Promise<CheckResult> {
    const localDate = getLocalBirthdayDate(now, this.timezone);
    const check = await this.birthdayCheckRepository.startCheck({
      checkDate: localDate.checkDate,
      timezone: this.timezone,
      trigger,
      startedAt: now
    });
    this.logger.info({
      event: "birthday.check.started",
      checkId: check.id,
      checkDate: localDate.checkDate,
      trigger,
      timezone: this.timezone
    });
    const counters = createCounters();
    try {
      const people = await this.personRepository.findBirthdaysByMonthDay(
        localDate.month,
        localDate.day
      );
      counters.birthdaysFound = people.length;
      this.recordBirthdaysFound(check.id, people.length);
      for (const person of people) {
        const result = await this.processBirthday({
          person,
          checkId: check.id,
          birthdayYear: localDate.year
        });
        applyProcessResult(counters, result);
      }
      await this.finishCheck(check.id, counters, "completed", now, null);
      this.recordCompletedCheck(check.id, trigger, counters);
      return createCheckResult(trigger, now, counters);
    } catch (error) {
      counters.failures += 1;
      await this.finishCheck(check.id, counters, "failed", now, readErrorMessage(error));
      this.recordFailedCheck(check.id, trigger, counters, error);
      return createCheckResult(trigger, now, counters);
    }
  }

  private async processBirthday(input: ProcessBirthdayInput): Promise<ProcessResult> {
    const lockKey = createDeliveryKey(input.person.id, this.groupId, input.birthdayYear);
    return this.withDeliveryLock(lockKey, () => this.processBirthdayWithLock(input));
  }

  private async processBirthdayWithLock(input: ProcessBirthdayInput): Promise<ProcessResult> {
    const hasSuccessfulDelivery = await this.deliveryRepository.hasSuccessfulDelivery(
      input.person.id,
      this.groupId,
      input.birthdayYear
    );
    if (hasSuccessfulDelivery) {
      await this.recordSkippedDelivery(input);
      this.recordDeliverySkipped(input);
      return "skipped";
    }
    return this.generateAndSendMessage(input);
  }

  private async generateAndSendMessage(input: ProcessBirthdayInput): Promise<ProcessResult> {
    let messageText = "";
    try {
      const priorMessages = await this.deliveryRepository.findSuccessfulMessagesByPerson(
        input.person.id,
        this.groupId,
        5
      );
      const generated = await this.messageGenerator.generate({
        person: input.person,
        priorMessages,
        birthdayYear: input.birthdayYear
      });
      this.recordGeneratedMessage(
        input,
        generated.provider,
        generated.fallbackReason,
        generated.fallbackDetails
      );
      messageText = generated.message;
      const sendResult = await this.whatsappClient.sendGroupMessage(this.groupId, messageText);
      const attempt = await this.deliveryRepository.recordAttempt({
        personId: input.person.id,
        groupId: this.groupId,
        birthdayYear: input.birthdayYear,
        checkId: input.checkId,
        messageText,
        status: "sent",
        providerMessageId: sendResult.providerMessageId,
        errorCode: null,
        errorMessage: null
      });
      this.recordDeliverySent(input, attempt.id, sendResult.providerMessageId);
      return "sent";
    } catch (error) {
      if (isDuplicateSuccessfulDeliveryError(error)) {
        await this.recordSkippedDelivery(input);
        this.recordDeliverySkipped(input);
        return "skipped";
      }
      await this.recordFailedDelivery(input, messageText, error);
      this.recordDeliveryFailed(input, error);
      return "failed";
    }
  }

  private async recordSkippedDelivery(input: ProcessBirthdayInput): Promise<void> {
    await this.deliveryRepository.recordAttempt({
      personId: input.person.id,
      groupId: this.groupId,
      birthdayYear: input.birthdayYear,
      checkId: input.checkId,
      messageText: "Skipped because a successful delivery already exists.",
      status: "skipped",
      providerMessageId: null,
      errorCode: "DUPLICATE_SUCCESSFUL_DELIVERY",
      errorMessage: null
    });
  }

  private recordBirthdaysFound(checkId: string, count: number): void {
    this.metrics.incrementCounter("birthday_birthdays_found_total", {}, count);
    this.logger.info({
      event: "birthday.check.birthdays_found",
      checkId,
      birthdaysFound: count
    });
  }

  private recordCompletedCheck(
    checkId: string,
    trigger: CheckTrigger,
    counters: CheckCounters
  ): void {
    this.metrics.incrementCounter("birthday_checks_total", { status: "completed" });
    this.logger.info({
      event: "birthday.check.completed",
      checkId,
      trigger,
      ...counters
    });
  }

  private recordFailedCheck(
    checkId: string,
    trigger: CheckTrigger,
    counters: CheckCounters,
    error: unknown
  ): void {
    this.metrics.incrementCounter("birthday_checks_total", { status: "failed" });
    this.logger.error({
      event: "birthday.check.failed",
      checkId,
      trigger,
      errorCode: readErrorCode(error),
      errorMessage: readErrorMessage(error),
      ...counters
    });
  }

  private recordGeneratedMessage(
    input: ProcessBirthdayInput,
    provider: string,
    fallbackReason: string | null,
    fallbackDetails: {
      status: number | null;
      statusText: string | null;
      requestId: string | null;
    } | null
  ): void {
    if (provider !== "fallback" || fallbackReason === null) {
      return;
    }
    this.metrics.incrementCounter("birthday_message_generation_failures_total");
    this.logger.warn({
      event: "birthday.message_generation.fallback",
      checkId: input.checkId,
      personId: input.person.id,
      birthdayYear: input.birthdayYear,
      reason: fallbackReason,
      openAiStatus: fallbackDetails?.status ?? null,
      openAiStatusText: fallbackDetails?.statusText ?? null,
      openAiRequestId: fallbackDetails?.requestId ?? null
    });
  }

  private recordDeliverySent(
    input: ProcessBirthdayInput,
    deliveryAttemptId: string,
    providerMessageId: string | null
  ): void {
    this.metrics.incrementCounter("birthday_delivery_attempts_total", { status: "sent" });
    this.logger.info({
      event: "birthday.delivery.sent",
      checkId: input.checkId,
      deliveryAttemptId,
      personId: input.person.id,
      birthdayYear: input.birthdayYear,
      providerMessageRecorded: providerMessageId !== null
    });
  }

  private recordDeliverySkipped(input: ProcessBirthdayInput): void {
    this.metrics.incrementCounter("birthday_delivery_attempts_total", { status: "skipped" });
    this.metrics.incrementCounter("birthday_duplicate_skips_total");
    this.logger.warn({
      event: "birthday.delivery.duplicate_skipped",
      checkId: input.checkId,
      personId: input.person.id,
      birthdayYear: input.birthdayYear
    });
  }

  private recordDeliveryFailed(input: ProcessBirthdayInput, error: unknown): void {
    this.metrics.incrementCounter("birthday_delivery_attempts_total", { status: "failed" });
    this.logger.error({
      event: "birthday.delivery.failed",
      checkId: input.checkId,
      personId: input.person.id,
      birthdayYear: input.birthdayYear,
      errorCode: readErrorCode(error),
      errorMessage: readErrorMessage(error)
    });
  }

  private async recordFailedDelivery(
    input: ProcessBirthdayInput,
    messageText: string,
    error: unknown
  ): Promise<void> {
    await this.deliveryRepository.recordAttempt({
      personId: input.person.id,
      groupId: this.groupId,
      birthdayYear: input.birthdayYear,
      checkId: input.checkId,
      messageText,
      status: "failed",
      providerMessageId: null,
      errorCode: readErrorCode(error),
      errorMessage: readErrorMessage(error)
    });
  }

  private async finishCheck(
    id: string,
    counters: CheckCounters,
    status: "completed" | "failed",
    finishedAt: Date,
    errorMessage: string | null
  ): Promise<void> {
    await this.birthdayCheckRepository.finishCheck(id, {
      status,
      birthdaysFound: counters.birthdaysFound,
      deliveriesSent: counters.deliveriesSent,
      duplicateSkips: counters.duplicateSkips,
      failures: counters.failures,
      finishedAt,
      errorMessage
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

type ProcessResult = "sent" | "skipped" | "failed";

function createCounters(): CheckCounters {
  return {
    birthdaysFound: 0,
    deliveriesSent: 0,
    duplicateSkips: 0,
    failures: 0
  };
}

function applyProcessResult(counters: CheckCounters, result: ProcessResult): void {
  if (result === "sent") {
    counters.deliveriesSent += 1;
    return;
  }
  if (result === "skipped") {
    counters.duplicateSkips += 1;
    return;
  }
  counters.failures += 1;
}

function createCheckResult(
  trigger: CheckTrigger,
  processedAt: Date,
  counters: CheckCounters
): CheckResult {
  return {
    trigger,
    processedAt,
    birthdaysFound: counters.birthdaysFound,
    deliveriesSent: counters.deliveriesSent,
    duplicateSkips: counters.duplicateSkips,
    failures: counters.failures
  };
}

function createDeliveryKey(personId: string, groupId: string, birthdayYear: number): string {
  return `${createBirthdayDedupeKey(personId, birthdayYear)}:${groupId}`;
}

const nullLogger: StructuredLogger = {
  info() {
    return undefined;
  },
  warn() {
    return undefined;
  },
  error() {
    return undefined;
  }
};

const nullMetricsRegistry: MetricsRegistry = {
  incrementCounter() {
    return undefined;
  }
};

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

function isDuplicateSuccessfulDeliveryError(error: unknown): boolean {
  return error instanceof Error && error.name === "DuplicateSuccessfulDeliveryError";
}
