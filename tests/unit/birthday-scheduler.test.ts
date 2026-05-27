import { describe, expect, it } from "vitest";
import {
  DefaultBirthdayScheduler,
  getNextDailyRunAt,
  type TimerHandle
} from "../../src/scheduler/index.js";
import type {
  BirthdayService,
  CheckInput,
  CheckResult,
  RecoveryCheckInput
} from "../../src/domain/index.js";

const timezone = "America/Sao_Paulo";

describe("DefaultBirthdayScheduler", () => {
  it("calculates the next run for today in the configured timezone", () => {
    const now = new Date("2026-05-26T11:59:00.000Z");

    expect(getNextDailyRunAt(now, timezone, "09:00")).toEqual(new Date("2026-05-26T12:00:00.000Z"));
  });

  it("rolls the next run to tomorrow when today's configured time passed", () => {
    const now = new Date("2026-05-26T12:01:00.000Z");

    expect(getNextDailyRunAt(now, timezone, "09:00")).toEqual(new Date("2026-05-27T12:00:00.000Z"));
  });

  it("schedules and executes a daily check through the service", async () => {
    const service = new FakeBirthdayService();
    const timers = new FakeTimers();
    const scheduler = new DefaultBirthdayScheduler({
      service,
      timezone,
      dailyCheckTime: "09:00",
      now: () => timers.now,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      logger: new MemoryLogger()
    });

    await scheduler.start();

    expect(timers.delayMs).toBe(60_000);
    timers.now = new Date("2026-05-26T12:00:00.000Z");
    await timers.fire();

    expect(service.dailyChecks).toEqual([
      {
        trigger: "scheduled",
        now: new Date("2026-05-26T12:00:00.000Z")
      }
    ]);
    expect(timers.delayMs).toBe(86_400_000);
    await scheduler.stop();
    expect(timers.cleared).toBe(true);
  });
});

class FakeBirthdayService implements BirthdayService {
  readonly dailyChecks: CheckInput[] = [];

  async runDailyCheck(input: CheckInput): Promise<CheckResult> {
    this.dailyChecks.push(input);
    return {
      trigger: input.trigger,
      processedAt: input.now,
      birthdaysFound: 0,
      deliveriesSent: 0,
      duplicateSkips: 0,
      failures: 0
    };
  }

  async runRecoveryCheck(input: RecoveryCheckInput): Promise<CheckResult> {
    return {
      trigger: input.reason,
      processedAt: input.now,
      birthdaysFound: 0,
      deliveriesSent: 0,
      duplicateSkips: 0,
      failures: 0
    };
  }
}

class FakeTimers {
  now = new Date("2026-05-26T11:59:00.000Z");
  delayMs = 0;
  cleared = false;
  private callback: (() => void) | null = null;

  setTimer = (callback: () => void, delayMs: number): TimerHandle => {
    this.callback = callback;
    this.delayMs = delayMs;
    this.cleared = false;
    return 1 as unknown as TimerHandle;
  };

  clearTimer = (): void => {
    this.cleared = true;
  };

  async fire(): Promise<void> {
    this.callback?.();
    await Promise.resolve();
    await Promise.resolve();
  }
}

class MemoryLogger {
  info(): void {
    return undefined;
  }

  error(): void {
    return undefined;
  }
}
