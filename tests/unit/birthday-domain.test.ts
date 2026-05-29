import { describe, expect, it } from "vitest";
import {
  BirthDate,
  createBirthdayDedupeKey,
  getLocalBirthdayDate
} from "../../src/domain/index.js";

describe("birthday domain", () => {
  it("parses birth dates and compares by month and day", () => {
    const birthDate = BirthDate.fromString("1990-05-26");

    expect(birthDate.value).toBe("1990-05-26");
    expect(birthDate.month).toBe(5);
    expect(birthDate.day).toBe(26);
    expect(birthDate.occursOn(5, 26)).toBe(true);
    expect(birthDate.occursOn(5, 27)).toBe(false);
  });

  it("rejects invalid birth dates", () => {
    expect(() => BirthDate.fromString("1990-02-30")).toThrow(
      "BirthDate must be a valid calendar date."
    );
    expect(() => BirthDate.fromString("05-26-1990")).toThrow(
      "BirthDate must use YYYY-MM-DD format."
    );
  });

  it("calculates local birthday date in the configured timezone", () => {
    expect(getLocalBirthdayDate(new Date("2026-05-27T02:30:00.000Z"), "America/Sao_Paulo")).toEqual(
      {
        year: 2026,
        month: 5,
        day: 26,
        checkDate: "2026-05-26"
      }
    );
  });

  it("creates stable birthday dedupe keys", () => {
    expect(createBirthdayDedupeKey("person-1", 2026)).toBe("birthday:person-1:2026");
    expect(() => createBirthdayDedupeKey("", 2026)).toThrow(
      "Person id is required to create a birthday dedupe key."
    );
  });
});
