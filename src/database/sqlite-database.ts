import { writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase, ParamsObject, SqlValue } from "sql.js";

export type SqliteParam = SqlValue;
export type SqliteParams = SqliteParam[] | Record<string, SqliteParam> | null;
export type SqliteRow = ParamsObject;

export interface OpenSqliteDatabaseOptions {
  path?: string;
}

export class SqliteDatabase {
  readonly raw: SqlJsDatabase;
  private readonly filePath: string | null;

  constructor(raw: SqlJsDatabase, filePath: string | null) {
    this.raw = raw;
    this.filePath = filePath;
    this.raw.run("PRAGMA foreign_keys = ON;");
  }

  run(sql: string, params: SqliteParams = null): void {
    this.raw.run(sql, params);
    this.persist();
  }

  exec(sql: string): void {
    this.raw.exec(sql);
    this.persist();
  }

  all(sql: string, params: SqliteParams = null): SqliteRow[] {
    const statement = this.raw.prepare(sql);
    try {
      statement.bind(params);
      const rows: SqliteRow[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  get(sql: string, params: SqliteParams = null): SqliteRow | null {
    return this.all(sql, params)[0] ?? null;
  }

  transaction<T>(callback: () => T): T {
    this.raw.run("BEGIN IMMEDIATE;");
    try {
      const result = callback();
      this.raw.run("COMMIT;");
      this.persist();
      return result;
    } catch (error) {
      this.raw.run("ROLLBACK;");
      throw error;
    }
  }

  persist(): void {
    if (this.filePath === null) {
      return;
    }
    const bytes = this.raw.export();
    writeFileSync(this.filePath, bytes);
  }

  async save(): Promise<void> {
    if (this.filePath === null) {
      return;
    }
    await writeFile(this.filePath, this.raw.export());
  }

  close(): void {
    this.raw.close();
  }
}

export async function openSqliteDatabase(
  options: OpenSqliteDatabaseOptions = {}
): Promise<SqliteDatabase> {
  const SQL = await initSqlJs();
  const filePath = normalizeDatabasePath(options.path);
  if (filePath === null) {
    return new SqliteDatabase(new SQL.Database(), null);
  }

  await mkdir(dirname(filePath), { recursive: true });
  const existingData = await readExistingDatabase(filePath);
  return new SqliteDatabase(new SQL.Database(existingData), filePath);
}

async function readExistingDatabase(filePath: string): Promise<Uint8Array | null> {
  try {
    const file = await readFile(filePath);
    return Uint8Array.from(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function normalizeDatabasePath(path: string | undefined): string | null {
  if (!path || path === ":memory:") {
    return null;
  }
  return path;
}
