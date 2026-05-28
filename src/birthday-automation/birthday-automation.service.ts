import { Inject, Injectable } from "@nestjs/common";
import {
  AUTOMATION_RUNNER,
  type AutomationRunResult,
  type AutomationRunner
} from "../automation/index.js";
import type { AutomationTrigger } from "../database/index.js";
import { BIRTHDAY_AUTOMATION_KEY } from "./birthday-automation.handler.js";

@Injectable()
export class BirthdayAutomationService {
  constructor(
    @Inject(AUTOMATION_RUNNER)
    private readonly runner: AutomationRunner
  ) {}

  async runToday(trigger: AutomationTrigger, now: Date = new Date()): Promise<AutomationRunResult> {
    return this.runner.run(BIRTHDAY_AUTOMATION_KEY, trigger, now);
  }
}
