interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const MINUTE_MS = 60 * 1000;

export function getNextDailyRunAt(now: Date, timezone: string, dailyCheckTime: string): Date {
  const { hour, minute } = parseDailyCheckTime(dailyCheckTime);
  const localNow = getLocalDateTimeParts(now, timezone);
  const todayTarget = localDateTimeToUtc(
    {
      year: localNow.year,
      month: localNow.month,
      day: localNow.day,
      hour,
      minute
    },
    timezone
  );
  if (todayTarget.getTime() > now.getTime()) {
    return todayTarget;
  }
  const tomorrow = addLocalDays(localNow, 1);
  return localDateTimeToUtc(
    {
      year: tomorrow.year,
      month: tomorrow.month,
      day: tomorrow.day,
      hour,
      minute
    },
    timezone
  );
}

function parseDailyCheckTime(dailyCheckTime: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(dailyCheckTime);
  if (match === null) {
    throw new Error("dailyCheckTime must use HH:mm in 24-hour format.");
  }
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function getLocalDateTimeParts(date: Date, timezone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return {
    year: readDatePart(parts, "year"),
    month: readDatePart(parts, "month"),
    day: readDatePart(parts, "day"),
    hour: readDatePart(parts, "hour"),
    minute: readDatePart(parts, "minute")
  };
}

function localDateTimeToUtc(local: LocalDateTimeParts, timezone: string): Date {
  let utcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = getLocalDateTimeParts(new Date(utcMs), timezone);
    const diffMinutes = diffLocalMinutes(local, rendered);
    if (diffMinutes === 0) {
      break;
    }
    utcMs += diffMinutes * MINUTE_MS;
  }
  return new Date(utcMs);
}

function diffLocalMinutes(left: LocalDateTimeParts, right: LocalDateTimeParts): number {
  return (
    (Date.UTC(left.year, left.month - 1, left.day, left.hour, left.minute) -
      Date.UTC(right.year, right.month - 1, right.day, right.hour, right.minute)) /
    MINUTE_MS
  );
}

function addLocalDays(local: LocalDateTimeParts, days: number): LocalDateTimeParts {
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: local.hour,
    minute: local.minute
  };
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) {
    throw new Error(`Could not read local date ${type}.`);
  }
  return Number(value);
}
