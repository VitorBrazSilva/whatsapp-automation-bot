import type { AutomationRunResult } from "../../../domain/index.js";
import type { AutomationRunInput } from "../driven/index.js";

export interface RunBirthdayAutomationUseCasePort {
  execute(input: AutomationRunInput): Promise<AutomationRunResult>;
}
