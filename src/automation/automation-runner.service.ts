import { Inject, Injectable } from "@nestjs/common";
import {
  RunAutomationUseCase,
  type AutomationWorkflow,
  type AutomationWorkflowRegistryPort
} from "../application/index.js";
import type { AutomationTrigger } from "../domain/index.js";
import { APP_CONFIG, type AppConfig } from "../infrastructure/config/index.js";
import { TypeOrmAutomationRunRepositoryAdapter } from "../infrastructure/index.js";
import type { AutomationRunResult, AutomationRunner } from "./automation-contracts.js";
import { AutomationRegistryService } from "./automation-registry.service.js";

@Injectable()
export class AutomationRunnerService implements AutomationRunner {
  private readonly useCase: RunAutomationUseCase;

  constructor(
    @Inject(TypeOrmAutomationRunRepositoryAdapter)
    runs: TypeOrmAutomationRunRepositoryAdapter,
    @Inject(AutomationRegistryService)
    registry: AutomationRegistryService,
    @Inject(APP_CONFIG)
    config: AppConfig
  ) {
    this.useCase = new RunAutomationUseCase({
      timezone: config.timezone,
      runs,
      workflows: createWorkflowRegistryPort(registry)
    });
  }

  async run(key: string, trigger: AutomationTrigger, now: Date): Promise<AutomationRunResult> {
    return this.useCase.execute({
      automationKey: key,
      trigger,
      now
    });
  }
}

function createWorkflowRegistryPort(
  registry: AutomationRegistryService
): AutomationWorkflowRegistryPort {
  return {
    get(key: string): AutomationWorkflow {
      return registry.get(key);
    }
  };
}
