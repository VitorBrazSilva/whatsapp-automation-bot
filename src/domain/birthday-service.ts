import type { MessageGenerator, WhatsAppClient } from "../integrations/index.js";
import type {
  BirthdayCheckRepository,
  DeliveryRepository,
  PersonRepository
} from "../repositories/index.js";
import { DuplicateSuccessfulDeliveryError } from "../repositories/index.js";
import type { Person } from "./person.js";

export type CheckTrigger = "scheduled" | "startup" | "whatsapp-reconnect" | "manual";
export type RecoveryReason = Extract<CheckTrigger, "startup" | "whatsapp-reconnect">;

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

export interface CreateBirthdayServiceOptions {
  timezone: string;
  groupId: string;
  personRepository: PersonRepository;
  birthdayCheckRepository: BirthdayCheckRepository;
  deliveryRepository: DeliveryRepository;
  messageGenerator: MessageGenerator;
  whatsappClient: WhatsAppClient;
}

interface LocalBirthdayDate {
  year: number;
  month: number;
  day: number;
  checkDate: string;
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
  private readonly deliveryLocks = new Map<string, Promise<void>>();

  constructor(options: CreateBirthdayServiceOptions) {
    this.timezone = options.timezone;
    this.groupId = options.groupId;
    this.personRepository = options.personRepository;
    this.birthdayCheckRepository = options.birthdayCheckRepository;
    this.deliveryRepository = options.deliveryRepository;
    this.messageGenerator = options.messageGenerator;
    this.whatsappClient = options.whatsappClient;
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
    const counters = createCounters();
    try {
      const people = await this.personRepository.findBirthdaysByMonthDay(
        localDate.month,
        localDate.day
      );
      counters.birthdaysFound = people.length;
      for (const person of people) {
        const result = await this.processBirthday({
          person,
          checkId: check.id,
          birthdayYear: localDate.year
        });
        applyProcessResult(counters, result);
      }
      await this.finishCheck(check.id, counters, "completed", now, null);
      return createCheckResult(trigger, now, counters);
    } catch (error) {
      counters.failures += 1;
      await this.finishCheck(check.id, counters, "failed", now, readErrorMessage(error));
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
      messageText = generated.message;
      const sendResult = await this.whatsappClient.sendGroupMessage(this.groupId, messageText);
      await this.deliveryRepository.recordAttempt({
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
      return "sent";
    } catch (error) {
      if (error instanceof DuplicateSuccessfulDeliveryError) {
        await this.recordSkippedDelivery(input);
        return "skipped";
      }
      await this.recordFailedDelivery(input, messageText, error);
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

export function getLocalBirthdayDate(now: Date, timezone: string): LocalBirthdayDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = readDatePart(parts, "year");
  const month = readDatePart(parts, "month");
  const day = readDatePart(parts, "day");
  return {
    year,
    month,
    day,
    checkDate: `${year}-${padDatePart(month)}-${padDatePart(day)}`
  };
}

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
  return `${personId}:${groupId}:${birthdayYear}`;
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) {
    throw new Error(`Could not read local date ${type}.`);
  }
  return Number(value);
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function readErrorCode(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  return "UNKNOWN_ERROR";
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error.";
}
