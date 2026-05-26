export type CheckTrigger = "scheduled" | "startup" | "whatsapp-reconnect" | "manual";

export interface CheckInput {
  trigger: CheckTrigger;
  now: Date;
}

export interface RecoveryCheckInput {
  reason: Exclude<CheckTrigger, "scheduled" | "manual">;
  now: Date;
}

export interface CheckResult {
  trigger: CheckTrigger;
  processedAt: Date;
  birthdaysFound: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
}

export interface BirthdayService {
  runDailyCheck(input: CheckInput): Promise<CheckResult>;
  runRecoveryCheck(input: RecoveryCheckInput): Promise<CheckResult>;
}
