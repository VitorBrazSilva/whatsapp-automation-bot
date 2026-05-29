import type { AutomationRunResult, AutomationTrigger } from "../../../domain/index.js";

export interface RunAutomationCommand {
  automationKey: string;
  trigger: AutomationTrigger;
  now: Date;
}

export interface RunAutomationUseCasePort {
  execute(command: RunAutomationCommand): Promise<AutomationRunResult>;
}
