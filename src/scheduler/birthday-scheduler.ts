import type { BirthdayService } from "../domain/index.js";
import {
  JsonLogger,
  readErrorCode,
  readErrorMessage,
  type StructuredLogger
} from "../observability/index.js";

export interface BirthdayScheduler {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface DefaultBirthdaySchedulerOptions {
  service: BirthdayService;
  timezone: string;
  dailyCheckTime: string;
  now?: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  logger?: StructuredLogger;
}

export type TimerHandle = ReturnType<typeof setTimeout>;

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const MINUTE_MS = 60 * 1000;

export class DefaultBirthdayScheduler implements BirthdayScheduler {
  private readonly service: BirthdayService;
  private readonly timezone: string;
  private readonly dailyCheckTime: string;
  private readonly now: () => Date;
  private readonly setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  private readonly clearTimer: (handle: TimerHandle) => void;
  private readonly logger: StructuredLogger;
  private timer: TimerHandle | null = null;
  private stopped = true;

  constructor(options: DefaultBirthdaySchedulerOptions) {
    this.service = options.service;
    this.timezone = options.timezone;
    this.dailyCheckTime = options.dailyCheckTime;
    this.now = options.now ?? (() => new Date());
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.logger = options.logger ?? consoleJsonLogger;
  }

  async start(): Promise<void> {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.scheduleNext();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const nextRunAt = getNextDailyRunAt(now, this.timezone, this.dailyCheckTime);
    const delayMs = Math.max(0, nextRunAt.getTime() - now.getTime());
    this.logger.info({
      event: "birthday.scheduler.scheduled",
      nextRunAt: nextRunAt.toISOString(),
      timezone: this.timezone,
      dailyCheckTime: this.dailyCheckTime
    });
    this.timer = this.setTimer(() => {
      void this.runScheduledCheck();
    }, delayMs);
  }

  private async runScheduledCheck(): Promise<void> {
    this.timer = null;
    const runStartedAt = this.now();
    try {
      const result = await this.service.runDailyCheck({
        trigger: "scheduled",
        now: runStartedAt
      });
      this.logger.info({
        event: "birthday.scheduler.completed",
        ...result,
        processedAt: result.processedAt.toISOString()
      });
    } catch (error) {
      this.logger.error({
        event: "birthday.scheduler.failed",
        errorCode: readErrorCode(error),
        errorMessage: readErrorMessage(error)
      });
    } finally {
      this.scheduleNext();
    }
  }
}

export function getNextDailyRunAt(now: Date, timezone: string, dailyCheckTime: string): Date {
  const { hour, minute } = parseDailyCheckTime(dailyCheckTime);
  const localNow = getLocalDateTimeParts(now, timezone);
  const todayTarget = localDateTimeToUtc(
    {
      year: localNow.year,
      month: localNow.month,
      day: localNow.day,
      hour,
      minute
    },
    timezone
  );
  if (todayTarget.getTime() > now.getTime()) {
    return todayTarget;
  }
  const tomorrow = addLocalDays(localNow, 1);
  return localDateTimeToUtc(
    {
      year: tomorrow.year,
      month: tomorrow.month,
      day: tomorrow.day,
      hour,
      minute
    },
    timezone
  );
}

function parseDailyCheckTime(dailyCheckTime: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(dailyCheckTime);
  if (match === null) {
    throw new Error("dailyCheckTime must use HH:mm in 24-hour format.");
  }
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function getLocalDateTimeParts(date: Date, timezone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return {
    year: readDatePart(parts, "year"),
    month: readDatePart(parts, "month"),
    day: readDatePart(parts, "day"),
    hour: readDatePart(parts, "hour"),
    minute: readDatePart(parts, "minute")
  };
}

function localDateTimeToUtc(local: LocalDateTimeParts, timezone: string): Date {
  let utcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = getLocalDateTimeParts(new Date(utcMs), timezone);
    const diffMinutes = diffLocalMinutes(local, rendered);
    if (diffMinutes === 0) {
      break;
    }
    utcMs += diffMinutes * MINUTE_MS;
  }
  return new Date(utcMs);
}

function diffLocalMinutes(left: LocalDateTimeParts, right: LocalDateTimeParts): number {
  return (
    (Date.UTC(left.year, left.month - 1, left.day, left.hour, left.minute) -
      Date.UTC(right.year, right.month - 1, right.day, right.hour, right.minute)) /
    MINUTE_MS
  );
}

function addLocalDays(local: LocalDateTimeParts, days: number): LocalDateTimeParts {
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: local.hour,
    minute: local.minute
  };
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) {
    throw new Error(`Could not read local date ${type}.`);
  }
  return Number(value);
}

const consoleJsonLogger = new JsonLogger();
