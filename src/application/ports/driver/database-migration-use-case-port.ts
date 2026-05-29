import type { AppliedDatabaseMigration } from "../driven/index.js";

export interface RunDatabaseMigrationsUseCasePort {
  execute(): Promise<AppliedDatabaseMigration[]>;
}
