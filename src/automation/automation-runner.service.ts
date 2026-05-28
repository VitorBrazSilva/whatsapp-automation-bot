import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { APP_CONFIG, type AppConfig } from "../config/index.js";
import { AutomationRunEntity, type AutomationTrigger } from "../database/index.js";
import { readErrorMessage } from "../observability/index.js";
import type { AutomationRunResult, AutomationRunner } from "./automation-contracts.js";
import { AutomationRegistryService } from "./automation-registry.service.js";

@Injectable()
export class AutomationRunnerService implements AutomationRunner {
  constructor(
    @InjectRepository(AutomationRunEntity)
    private readonly runs: Repository<AutomationRunEntity>,
    @Inject(AutomationRegistryService)
    private readonly registry: AutomationRegistryService,
    @Inject(APP_CONFIG)
    private readonly config: AppConfig
  ) {}

  async run(key: string, trigger: AutomationTrigger, now: Date): Promise<AutomationRunResult> {
    const run = await this.createRun(key, trigger, now);
    const handler = this.registry.get(key);
    try {
      const result = await handler.run({
        runId: run.id,
        automationKey: key,
        trigger,
        now
      });
      await this.finishRun(run.id, "completed", result, now, null);
      return result;
    } catch (error) {
      const result = createFailedResult();
      await this.finishRun(run.id, "failed", result, now, readErrorMessage(error));
      throw error;
    }
  }

  private async createRun(
    automationKey: string,
    trigger: AutomationTrigger,
    now: Date
  ): Promise<AutomationRunEntity> {
    return this.runs.save(
      this.runs.create({
        id: randomUUID(),
        automationKey,
        trigger,
        targetDate: formatLocalDate(now, this.config.timezone),
        timezone: this.config.timezone,
        status: "started",
        itemsMatched: 0,
        deliveriesSent: 0,
        duplicateSkips: 0,
        failures: 0,
        startedAt: now,
        finishedAt: null,
        errorMessage: null
      })
    );
  }

  private async finishRun(
    id: string,
    status: "completed" | "failed",
    result: AutomationRunResult,
    finishedAt: Date,
    errorMessage: string | null
  ): Promise<void> {
    await this.runs.update(id, {
      status,
      itemsMatched: result.itemsMatched,
      deliveriesSent: result.deliveriesSent,
      duplicateSkips: result.duplicateSkips,
      failures: result.failures,
      finishedAt,
      errorMessage
    });
  }
}

function createFailedResult(): AutomationRunResult {
  return {
    itemsMatched: 0,
    deliveriesSent: 0,
    duplicateSkips: 0,
    failures: 1
  };
}

function formatLocalDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return `${readPart(parts, "year")}-${readPart(parts, "month")}-${readPart(parts, "day")}`;
}

function readPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) {
    throw new Error(`Could not read local date ${type}.`);
  }
  return value;
}
