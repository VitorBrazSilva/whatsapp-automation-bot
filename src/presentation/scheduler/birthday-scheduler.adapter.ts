import { Inject, Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { AUTOMATION_RUNNER, type AutomationRunner } from "../../automation/index.js";
import { BIRTHDAY_AUTOMATION_KEY } from "../../domain/index.js";
import {
  APP_CONFIG,
  STRUCTURED_LOGGER,
  readErrorCode,
  readErrorMessage,
  type AppConfig,
  type StructuredLogger
} from "../../infrastructure/index.js";
import { getNextDailyRunAt } from "./schedule-time.js";

@Injectable()
export class BirthdaySchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timeoutName: string | null = null;

  constructor(
    @Inject(SchedulerRegistry)
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(AUTOMATION_RUNNER)
    private readonly automationRunner: AutomationRunner,
    @Inject(APP_CONFIG)
    private readonly config: AppConfig,
    @Inject(STRUCTURED_LOGGER)
    private readonly logger: StructuredLogger
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
    const timeoutName = `${BIRTHDAY_AUTOMATION_KEY}.${nextRunAt.toISOString()}`;
    const timeout = setTimeout(() => {
      void this.runScheduledCheck();
    }, delayMs);
    this.timeoutName = timeoutName;
    this.schedulerRegistry.addTimeout(timeoutName, timeout);
    this.logger.info({
      event: "automation.scheduler.scheduled",
      automation: BIRTHDAY_AUTOMATION_KEY,
      nextRunAt: nextRunAt.toISOString(),
      timezone: this.config.timezone
    });
  }

  private async runScheduledCheck(): Promise<void> {
    if (this.timeoutName !== null) {
      this.schedulerRegistry.deleteTimeout(this.timeoutName);
      this.timeoutName = null;
    }
    try {
      await this.automationRunner.run(BIRTHDAY_AUTOMATION_KEY, "scheduled", new Date());
    } catch (error) {
      this.logger.error({
        event: "automation.scheduler.failed",
        automation: BIRTHDAY_AUTOMATION_KEY,
        errorCode: readErrorCode(error),
        errorMessage: readErrorMessage(error)
      });
    } finally {
      this.scheduleNext();
    }
  }
}
