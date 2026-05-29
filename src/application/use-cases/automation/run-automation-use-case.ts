import { getLocalBirthdayDate, type AutomationRunResult } from "../../../domain/index.js";
import type {
  AutomationRunRepositoryPort,
  AutomationWorkflowRegistryPort,
  RunAutomationCommand,
  RunAutomationUseCasePort
} from "../../ports/index.js";

export interface RunAutomationUseCaseOptions {
  timezone: string;
  runs: AutomationRunRepositoryPort;
  workflows: AutomationWorkflowRegistryPort;
}

export class RunAutomationUseCase implements RunAutomationUseCasePort {
  private readonly timezone: string;
  private readonly runs: AutomationRunRepositoryPort;
  private readonly workflows: AutomationWorkflowRegistryPort;

  constructor(options: RunAutomationUseCaseOptions) {
    this.timezone = options.timezone;
    this.runs = options.runs;
    this.workflows = options.workflows;
  }

  async execute(command: RunAutomationCommand): Promise<AutomationRunResult> {
    const run = await this.runs.start({
      automationKey: command.automationKey,
      trigger: command.trigger,
      targetDate: getLocalBirthdayDate(command.now, this.timezone).checkDate,
      timezone: this.timezone,
      startedAt: command.now
    });
    const workflow = this.workflows.get(command.automationKey);
    try {
      const result = await workflow.run({
        runId: run.id,
        automationKey: command.automationKey,
        trigger: command.trigger,
        now: command.now
      });
      await this.finish(run.id, "completed", result, command.now, null);
      return result;
    } catch (error) {
      const result = createFailedResult();
      await this.finish(run.id, "failed", result, command.now, readErrorMessage(error));
      throw error;
    }
  }

  private async finish(
    runId: string,
    status: "completed" | "failed",
    result: AutomationRunResult,
    finishedAt: Date,
    errorMessage: string | null
  ): Promise<void> {
    await this.runs.finish(runId, {
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

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/\s+/g, " ").trim();
  }
  return "Unknown error.";
}
