import { describe, expect, it } from "vitest";
import { getNextDailyRunAt } from "../../src/presentation/scheduler/index.js";

const timezone = "America/Sao_Paulo";

describe("scheduler time calculation", () => {
  it("calculates the next run for today in the configured timezone", () => {
    const now = new Date("2026-05-26T11:59:00.000Z");

    expect(getNextDailyRunAt(now, timezone, "09:00")).toEqual(new Date("2026-05-26T12:00:00.000Z"));
  });

  it("rolls the next run to tomorrow when today's configured time passed", () => {
    const now = new Date("2026-05-26T12:01:00.000Z");

    expect(getNextDailyRunAt(now, timezone, "09:00")).toEqual(new Date("2026-05-27T12:00:00.000Z"));
  });

  it("rejects invalid daily time configuration", () => {
    expect(() => getNextDailyRunAt(new Date("2026-05-26T12:00:00.000Z"), timezone, "9:00")).toThrow(
      "dailyCheckTime must use HH:mm in 24-hour format."
    );
  });
});
