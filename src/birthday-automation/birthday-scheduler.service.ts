import { Inject, Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { APP_CONFIG, type AppConfig } from "../config/index.js";
import {
  STRUCTURED_LOGGER,
  readErrorCode,
  readErrorMessage,
  type StructuredLogger
} from "../observability/index.js";
import { getNextDailyRunAt } from "../scheduler/index.js";
import { BirthdayAutomationService } from "./birthday-automation.service.js";

@Injectable()
export class BirthdaySchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timeoutName: string | null = null;

  constructor(
    @Inject(SchedulerRegistry)
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(BirthdayAutomationService)
    private readonly birthdays: BirthdayAutomationService,
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
    const timeoutName = `birthdays.daily.${nextRunAt.toISOString()}`;
    const timeout = setTimeout(() => {
      void this.runScheduledCheck();
    }, delayMs);
    this.timeoutName = timeoutName;
    this.schedulerRegistry.addTimeout(timeoutName, timeout);
    this.logger.info({
      event: "automation.scheduler.scheduled",
      automation: "birthdays.daily",
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
      await this.birthdays.runToday("scheduled", new Date());
    } catch (error) {
      this.logger.error({
        event: "automation.scheduler.failed",
        automation: "birthdays.daily",
        errorCode: readErrorCode(error),
        errorMessage: readErrorMessage(error)
      });
    } finally {
      this.scheduleNext();
    }
  }
}
