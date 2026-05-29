import type { AutomationRunResult, AutomationTrigger } from "../../../domain/index.js";

export interface AutomationRunInput {
  runId: string;
  automationKey: string;
  trigger: AutomationTrigger;
  now: Date;
}

export interface AutomationWorkflow {
  key: string;
  run(input: AutomationRunInput): Promise<AutomationRunResult>;
}

export interface AutomationWorkflowRegistryPort {
  get(key: string): AutomationWorkflow;
}
