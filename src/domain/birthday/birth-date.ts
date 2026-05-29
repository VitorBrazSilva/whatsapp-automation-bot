export interface LocalBirthdayDate {
  year: number;
  month: number;
  day: number;
  checkDate: string;
}

export class BirthDate {
  private constructor(readonly value: string) {}

  static fromString(value: string): BirthDate {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error("BirthDate must use YYYY-MM-DD format.");
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || value !== date.toISOString().slice(0, 10)) {
      throw new Error("BirthDate must be a valid calendar date.");
    }
    return new BirthDate(value);
  }

  get month(): number {
    return Number(this.value.slice(5, 7));
  }

  get day(): number {
    return Number(this.value.slice(8, 10));
  }

  occursOn(month: number, day: number): boolean {
    return this.month === month && this.day === day;
  }
}

export function getLocalBirthdayDate(now: Date, timezone: string): LocalBirthdayDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = readDatePart(parts, "year");
  const month = readDatePart(parts, "month");
  const day = readDatePart(parts, "day");
  return {
    year,
    month,
    day,
    checkDate: `${year}-${padDatePart(month)}-${padDatePart(day)}`
  };
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) {
    throw new Error(`Could not read local date ${type}.`);
  }
  return Number(value);
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
