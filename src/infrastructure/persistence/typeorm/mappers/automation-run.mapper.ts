import type { AutomationRun } from "../../../../application/index.js";
import type { AutomationRunEntity } from "../entities/index.js";

export function automationRunEntityToDomain(entity: AutomationRunEntity): AutomationRun {
  return {
    id: entity.id,
    automationKey: entity.automationKey,
    trigger: entity.trigger,
    targetDate: entity.targetDate,
    timezone: entity.timezone
  };
}
