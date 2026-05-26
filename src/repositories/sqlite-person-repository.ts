import { randomUUID } from "node:crypto";
import type { Person } from "../domain/index.js";
import type { SqliteDatabase, SqliteRow } from "../database/index.js";
import type { CreatePersonInput, PersonRepository } from "./person-repository.js";

export class SqlitePersonRepository implements PersonRepository {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(input: CreatePersonInput): Promise<Person> {
    const id = input.id ?? randomUUID();
    const now = input.createdAt ?? this.now();
    const updatedAt = input.updatedAt ?? now;

    this.database.run(
      `
        INSERT INTO people (
          id,
          name,
          nickname,
          birth_date,
          relationship,
          profession,
          hobbies,
          traits,
          message_style,
          notes,
          active,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.name,
        input.nickname ?? null,
        input.birthDate,
        input.relationship ?? null,
        input.profession ?? null,
        input.hobbies ?? null,
        input.traits ?? null,
        input.messageStyle ?? null,
        input.notes ?? null,
        input.active === false ? 0 : 1,
        now.toISOString(),
        updatedAt.toISOString()
      ]
    );

    const person = await this.findById(id);
    if (person === null) {
      throw new Error("Failed to read person after insert.");
    }
    return person;
  }

  async findBirthdaysByMonthDay(month: number, day: number): Promise<Person[]> {
    const rows = this.database.all(
      `
        SELECT *
        FROM people
        WHERE active = 1
          AND substr(birth_date, 6, 2) = ?
          AND substr(birth_date, 9, 2) = ?
        ORDER BY name ASC, id ASC
      `,
      [formatMonthDay(month), formatMonthDay(day)]
    );

    return rows.map(mapPersonRow);
  }

  async findById(id: string): Promise<Person | null> {
    const row = this.database.get("SELECT * FROM people WHERE id = ?", [id]);
    return row === null ? null : mapPersonRow(row);
  }
}

function mapPersonRow(row: SqliteRow): Person {
  return {
    id: readText(row.id),
    name: readText(row.name),
    nickname: readNullableText(row.nickname),
    birthDate: readText(row.birth_date),
    relationship: readNullableText(row.relationship),
    profession: readNullableText(row.profession),
    hobbies: readNullableText(row.hobbies),
    traits: readNullableText(row.traits),
    messageStyle: readNullableText(row.message_style),
    notes: readNullableText(row.notes),
    active: readInteger(row.active) === 1,
    createdAt: new Date(readText(row.created_at)),
    updatedAt: new Date(readText(row.updated_at))
  };
}

function formatMonthDay(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new Error("Month and day values must be positive integers.");
  }
  return String(value).padStart(2, "0");
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
