import { randomUUID } from "node:crypto";
import type { SqliteDatabase, SqliteRow } from "../database/index.js";
import type {
  DeliveryAttempt,
  DeliveryAttemptInput,
  DeliveryRepository,
  DeliveryStatus
} from "./delivery-repository.js";

export class DuplicateSuccessfulDeliveryError extends Error {
  constructor(personId: string, birthdayYear: number) {
    super(
      `Successful delivery already exists for person ${personId}, configured group, and birthday year ${birthdayYear}.`
    );
    this.name = "DuplicateSuccessfulDeliveryError";
  }
}

export class SqliteDeliveryRepository implements DeliveryRepository {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly now: () => Date = () => new Date()
  ) {}

  async hasSuccessfulDelivery(
    personId: string,
    groupId: string,
    birthdayYear: number
  ): Promise<boolean> {
    const row = this.database.get(
      `
        SELECT id
        FROM delivery_attempts
        WHERE person_id = ?
          AND group_id = ?
          AND birthday_year = ?
          AND status = 'sent'
        LIMIT 1
      `,
      [personId, groupId, birthdayYear]
    );
    return row !== null;
  }

  async findSuccessfulMessagesByPerson(
    personId: string,
    groupId: string,
    limit: number
  ): Promise<string[]> {
    const rows = this.database.all(
      `
        SELECT message_text
        FROM delivery_attempts
        WHERE person_id = ?
          AND group_id = ?
          AND status = 'sent'
        ORDER BY birthday_year DESC, created_at DESC
        LIMIT ?
      `,
      [personId, groupId, limit]
    );
    return rows.map((row) => readText(row.message_text));
  }

  async recordAttempt(input: DeliveryAttemptInput): Promise<DeliveryAttempt> {
    const id = randomUUID();
    const createdAt = this.now();

    try {
      this.database.run(
        `
          INSERT INTO delivery_attempts (
            id,
            person_id,
            group_id,
            birthday_year,
            check_id,
            message_text,
            status,
            provider_message_id,
            error_code,
            error_message,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          input.personId,
          input.groupId,
          input.birthdayYear,
          input.checkId,
          input.messageText,
          input.status,
          input.providerMessageId,
          input.errorCode,
          input.errorMessage,
          createdAt.toISOString()
        ]
      );
    } catch (error) {
      if (input.status === "sent" && isUniqueConstraintError(error)) {
        throw new DuplicateSuccessfulDeliveryError(input.personId, input.birthdayYear);
      }
      throw error;
    }

    const attempt = this.findById(id);
    if (attempt === null) {
      throw new Error("Failed to read delivery attempt after insert.");
    }
    return attempt;
  }

  findById(id: string): DeliveryAttempt | null {
    const row = this.database.get("SELECT * FROM delivery_attempts WHERE id = ?", [id]);
    return row === null ? null : mapDeliveryAttemptRow(row);
  }
}

function mapDeliveryAttemptRow(row: SqliteRow): DeliveryAttempt {
  return {
    id: readText(row.id),
    personId: readText(row.person_id),
    groupId: readText(row.group_id),
    birthdayYear: readInteger(row.birthday_year),
    checkId: readText(row.check_id),
    messageText: readText(row.message_text),
    status: readText(row.status) as DeliveryStatus,
    providerMessageId: readNullableText(row.provider_message_id),
    errorCode: readNullableText(row.error_code),
    errorMessage: readNullableText(row.error_message),
    createdAt: new Date(readText(row.created_at))
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
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
