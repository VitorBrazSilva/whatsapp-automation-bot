import {
  createBirthdayDeliveryKey,
  formatBirthdayDeliveryKey,
  getLocalBirthdayDate,
  type BirthdayDeliveryKey,
  type Person
} from "../../../domain/index.js";
import type {
  BirthdayReminderResult,
  BirthdayDeliveryRecord,
  BirthdayDeliveryRepository,
  BirthdayMessageGenerator,
  PersonRepository,
  RunBirthdayReminderInput,
  RunBirthdayReminderUseCasePort,
  WhatsAppGroupMessenger
} from "../../ports/birthday-reminder-ports.js";

export interface RunBirthdayReminderUseCaseOptions {
  timezone: string;
  groupJid: string;
  people: PersonRepository;
  deliveries: BirthdayDeliveryRepository;
  messageGenerator: BirthdayMessageGenerator;
  whatsapp: WhatsAppGroupMessenger;
}

interface BirthdayProcessInput {
  person: Person;
  key: BirthdayDeliveryKey;
}

type ProcessResult = "sent" | "skipped" | "failed";

const RECENT_MESSAGE_LIMIT = 5;

export class RunBirthdayReminderUseCase implements RunBirthdayReminderUseCasePort {
  private readonly timezone: string;
  private readonly groupJid: string;
  private readonly people: PersonRepository;
  private readonly deliveries: BirthdayDeliveryRepository;
  private readonly messageGenerator: BirthdayMessageGenerator;
  private readonly whatsapp: WhatsAppGroupMessenger;
  private readonly deliveryLocks = new Map<string, Promise<void>>();

  constructor(options: RunBirthdayReminderUseCaseOptions) {
    this.timezone = options.timezone;
    this.groupJid = options.groupJid;
    this.people = options.people;
    this.deliveries = options.deliveries;
    this.messageGenerator = options.messageGenerator;
    this.whatsapp = options.whatsapp;
  }

  async execute(input: RunBirthdayReminderInput): Promise<BirthdayReminderResult> {
    void input.trigger;
    const localDate = getLocalBirthdayDate(input.now, this.timezone);
    const people = await this.people.findActiveByBirthday(localDate.month, localDate.day);
    const result = createResult(people.length);
    for (const person of people) {
      const key = createBirthdayDeliveryKey({
        personId: person.id,
        groupJid: this.groupJid,
        birthdayYear: localDate.year
      });
      applyProcessResult(result, await this.processBirthday({ person, key }));
    }
    return result;
  }

  private async processBirthday(input: BirthdayProcessInput): Promise<ProcessResult> {
    const lockKey = formatBirthdayDeliveryKey(input.key);
    return this.withDeliveryLock(lockKey, () => this.processBirthdayWithLock(input));
  }

  private async processBirthdayWithLock(input: BirthdayProcessInput): Promise<ProcessResult> {
    if (await this.deliveries.hasSent(input.key)) {
      await this.recordSkippedDelivery(input.key);
      return "skipped";
    }
    return this.generateAndSendMessage(input);
  }

  private async generateAndSendMessage(input: BirthdayProcessInput): Promise<ProcessResult> {
    let messageText = "";
    try {
      const recentMessages = await this.deliveries.findRecentMessages(
        input.key.personId,
        input.key.groupJid,
        RECENT_MESSAGE_LIMIT
      );
      const generated = await this.messageGenerator.generate({
        person: input.person,
        priorMessages: recentMessages,
        birthdayYear: input.key.birthdayYear
      });
      messageText = generated.message;
      const sendResult = await this.whatsapp.sendGroupMessage(input.key.groupJid, messageText);
      await this.deliveries.record({
        key: input.key,
        messageText,
        status: "sent",
        provider: generated.provider,
        model: generated.model,
        providerMessageId: sendResult.providerMessageId,
        fallbackReason: generated.fallbackReason,
        errorCode: null,
        errorMessage: null
      });
      return "sent";
    } catch (error) {
      if (isDuplicateBirthdayDeliveryError(error)) {
        await this.recordSkippedDelivery(input.key);
        return "skipped";
      }
      await this.recordFailedDelivery(input.key, messageText, error);
      return "failed";
    }
  }

  private async recordSkippedDelivery(key: BirthdayDeliveryKey): Promise<void> {
    await this.deliveries.record({
      key,
      messageText: "Skipped because a successful delivery already exists.",
      status: "skipped",
      provider: null,
      model: null,
      providerMessageId: null,
      fallbackReason: null,
      errorCode: "DUPLICATE_SUCCESSFUL_DELIVERY",
      errorMessage: null
    });
  }

  private async recordFailedDelivery(
    key: BirthdayDeliveryKey,
    messageText: string,
    error: unknown
  ): Promise<void> {
    const record: BirthdayDeliveryRecord = {
      key,
      messageText,
      status: "failed",
      provider: null,
      model: null,
      providerMessageId: null,
      fallbackReason: null,
      errorCode: readErrorCode(error),
      errorMessage: readErrorMessage(error)
    };
    await this.deliveries.record(record);
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

function createResult(peopleMatched: number): BirthdayReminderResult {
  return {
    peopleMatched,
    sent: 0,
    skipped: 0,
    failed: 0
  };
}

function applyProcessResult(result: BirthdayReminderResult, processResult: ProcessResult): void {
  if (processResult === "sent") {
    result.sent += 1;
    return;
  }
  if (processResult === "skipped") {
    result.skipped += 1;
    return;
  }
  result.failed += 1;
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

function isDuplicateBirthdayDeliveryError(error: unknown): boolean {
  return error instanceof Error && error.name === "DuplicateBirthdayDeliveryError";
}
