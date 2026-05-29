import type { AutomationTrigger } from "../../../domain/index.js";

export interface AutomationRun {
  id: string;
  automationKey: string;
  trigger: AutomationTrigger;
  targetDate: string;
  timezone: string;
}

export interface StartAutomationRunInput {
  automationKey: string;
  trigger: AutomationTrigger;
  targetDate: string;
  timezone: string;
  startedAt: Date;
}

export interface FinishAutomationRunInput {
  status: "completed" | "failed";
  itemsMatched: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
  finishedAt: Date;
  errorMessage: string | null;
}

export interface AutomationRunRepositoryPort {
  start(input: StartAutomationRunInput): Promise<AutomationRun>;
  finish(id: string, input: FinishAutomationRunInput): Promise<void>;
}
