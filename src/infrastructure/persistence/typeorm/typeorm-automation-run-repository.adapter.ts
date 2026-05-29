import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  AutomationRun,
  AutomationRunRepositoryPort,
  FinishAutomationRunInput,
  StartAutomationRunInput
} from "../../../application/index.js";
import { AutomationRunEntity } from "./entities/index.js";
import { automationRunEntityToDomain } from "./mappers/index.js";

@Injectable()
export class TypeOrmAutomationRunRepositoryAdapter implements AutomationRunRepositoryPort {
  constructor(
    @InjectRepository(AutomationRunEntity)
    private readonly runs: Repository<AutomationRunEntity>
  ) {}

  async start(input: StartAutomationRunInput): Promise<AutomationRun> {
    const entity = this.runs.create({
      id: randomUUID(),
      automationKey: input.automationKey,
      trigger: input.trigger,
      targetDate: input.targetDate,
      timezone: input.timezone,
      status: "started",
      itemsMatched: 0,
      deliveriesSent: 0,
      duplicateSkips: 0,
      failures: 0,
      startedAt: input.startedAt,
      finishedAt: null,
      errorMessage: null
    });
    return automationRunEntityToDomain(await this.runs.save(entity));
  }

  async finish(id: string, input: FinishAutomationRunInput): Promise<void> {
    await this.runs.update(id, {
      status: input.status,
      itemsMatched: input.itemsMatched,
      deliveriesSent: input.deliveriesSent,
      duplicateSkips: input.duplicateSkips,
      failures: input.failures,
      finishedAt: input.finishedAt,
      errorMessage: input.errorMessage
    });
  }
}
