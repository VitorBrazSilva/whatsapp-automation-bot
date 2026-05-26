import { randomUUID } from "node:crypto";
import type { CheckTrigger } from "../domain/index.js";
import type { SqliteDatabase, SqliteRow } from "../database/index.js";
import type {
  BirthdayCheck,
  BirthdayCheckRepository,
  BirthdayCheckStatus,
  FinishBirthdayCheckInput,
  StartBirthdayCheckInput
} from "./birthday-check-repository.js";

export class SqliteBirthdayCheckRepository implements BirthdayCheckRepository {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly now: () => Date = () => new Date()
  ) {}

  async startCheck(input: StartBirthdayCheckInput): Promise<BirthdayCheck> {
    const id = input.id ?? randomUUID();
    const startedAt = input.startedAt ?? this.now();

    this.database.run(
      `
        INSERT INTO birthday_checks (
          id,
          check_date,
          timezone,
          trigger,
          status,
          started_at
        )
        VALUES (?, ?, ?, ?, 'started', ?)
      `,
      [id, input.checkDate, input.timezone, input.trigger, startedAt.toISOString()]
    );

    const check = await this.findById(id);
    if (check === null) {
      throw new Error("Failed to read birthday check after insert.");
    }
    return check;
  }

  async finishCheck(id: string, input: FinishBirthdayCheckInput): Promise<BirthdayCheck> {
    const finishedAt = input.finishedAt ?? this.now();

    this.database.run(
      `
        UPDATE birthday_checks
        SET
          status = ?,
          birthdays_found = ?,
          deliveries_sent = ?,
          duplicate_skips = ?,
          failures = ?,
          finished_at = ?,
          error_message = ?
        WHERE id = ?
      `,
      [
        input.status,
        input.birthdaysFound,
        input.deliveriesSent,
        input.duplicateSkips,
        input.failures,
        finishedAt.toISOString(),
        input.errorMessage ?? null,
        id
      ]
    );

    const check = await this.findById(id);
    if (check === null) {
      throw new Error(`Birthday check not found: ${id}`);
    }
    return check;
  }

  async findById(id: string): Promise<BirthdayCheck | null> {
    const row = this.database.get("SELECT * FROM birthday_checks WHERE id = ?", [id]);
    return row === null ? null : mapBirthdayCheckRow(row);
  }
}

function mapBirthdayCheckRow(row: SqliteRow): BirthdayCheck {
  return {
    id: readText(row.id),
    checkDate: readText(row.check_date),
    timezone: readText(row.timezone),
    trigger: readText(row.trigger) as CheckTrigger,
    status: readText(row.status) as BirthdayCheckStatus,
    birthdaysFound: readInteger(row.birthdays_found),
    deliveriesSent: readInteger(row.deliveries_sent),
    duplicateSkips: readInteger(row.duplicate_skips),
    failures: readInteger(row.failures),
    startedAt: new Date(readText(row.started_at)),
    finishedAt: readNullableDate(row.finished_at),
    errorMessage: readNullableText(row.error_message)
  };
}

function readText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected SQLite text value.");
  }
  return value;
}

function readNullableText(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  return readText(value);
}

function readInteger(value: unknown): number {
  if (typeof value !== "number") {
    throw new Error("Expected SQLite integer value.");
  }
  return value;
}

function readNullableDate(value: unknown): Date | null {
  const text = readNullableText(value);
  return text === null ? null : new Date(text);
}
