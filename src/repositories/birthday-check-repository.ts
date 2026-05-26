import type { CheckTrigger } from "../domain/index.js";

export type BirthdayCheckStatus = "started" | "completed" | "failed";

export interface BirthdayCheck {
  id: string;
  checkDate: string;
  timezone: string;
  trigger: CheckTrigger;
  status: BirthdayCheckStatus;
  birthdaysFound: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
}

export interface StartBirthdayCheckInput {
  id?: string;
  checkDate: string;
  timezone: string;
  trigger: CheckTrigger;
  startedAt?: Date;
}

export interface FinishBirthdayCheckInput {
  status: Exclude<BirthdayCheckStatus, "started">;
  birthdaysFound: number;
  deliveriesSent: number;
  duplicateSkips: number;
  failures: number;
  finishedAt?: Date;
  errorMessage?: string | null;
}

export interface BirthdayCheckRepository {
  startCheck(input: StartBirthdayCheckInput): Promise<BirthdayCheck>;
  finishCheck(id: string, input: FinishBirthdayCheckInput): Promise<BirthdayCheck>;
  findById(id: string): Promise<BirthdayCheck | null>;
}
