import { Inject, Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { RunBirthdayReminderUseCasePort } from "../../application/index.js";
import {
  APP_CONFIG,
  RUN_BIRTHDAY_REMINDER_USE_CASE,
  type AppConfig
} from "../../infrastructure/index.js";
import { getNextDailyRunAt } from "./schedule-time.js";

@Injectable()
export class BirthdaySchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timeoutName: string | null = null;

  constructor(
    @Inject(SchedulerRegistry)
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(RUN_BIRTHDAY_REMINDER_USE_CASE)
    private readonly reminder: RunBirthdayReminderUseCasePort,
    @Inject(APP_CONFIG)
    private readonly config: AppConfig
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.schedulerEnabled || this.config.nodeEnv === "test") {
      return;
    }
    this.scheduleNext();
  }

  onApplicationShutdown(): void {
    if (this.timeoutName === null) {
      return;
    }
    this.schedulerRegistry.deleteTimeout(this.timeoutName);
    this.timeoutName = null;
  }

  private scheduleNext(): void {
    const now = new Date();
    const nextRunAt = getNextDailyRunAt(now, this.config.timezone, this.config.dailyCheckTime);
    const delayMs = Math.max(0, nextRunAt.getTime() - now.getTime());
    const timeoutName = `birthday-reminder.${nextRunAt.toISOString()}`;
    const timeout = setTimeout(() => {
      void this.runScheduledCheck();
    }, delayMs);
    this.timeoutName = timeoutName;
    this.schedulerRegistry.addTimeout(timeoutName, timeout);
    console.info(
      JSON.stringify({
        event: "birthday.scheduler.scheduled",
        nextRunAt: nextRunAt.toISOString(),
        timezone: this.config.timezone
      })
    );
  }

  private async runScheduledCheck(): Promise<void> {
    if (this.timeoutName !== null) {
      this.schedulerRegistry.deleteTimeout(this.timeoutName);
      this.timeoutName = null;
    }
    try {
      const result = await this.reminder.execute({
        trigger: "scheduled",
        now: new Date()
      });
      console.info(
        JSON.stringify({
          event: "birthday.scheduler.completed",
          ...result
        })
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "birthday.scheduler.failed",
          errorCode: readErrorCode(error),
          errorMessage: readErrorMessage(error)
        })
      );
    } finally {
      this.scheduleNext();
    }
  }
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
