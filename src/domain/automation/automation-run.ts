export const BIRTHDAY_AUTOMATION_KEY = "birthdays.daily";

export type AutomationTrigger = "scheduled" | "startup" | "whatsapp-reconnect" | "manual";
export type CheckTrigger = AutomationTrigger;
export type RecoveryReason = Extract<AutomationTrigger, "startup" | "whatsapp-reconnect">;

export interface AutomationRunResult {
  itemsMatched: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
}
