import type {
  AppliedDatabaseMigration,
  DatabaseMigrationPort,
  RunDatabaseMigrationsUseCasePort
} from "../../ports/index.js";

export class RunDatabaseMigrationsUseCase implements RunDatabaseMigrationsUseCasePort {
  constructor(private readonly migrations: DatabaseMigrationPort) {}

  async execute(): Promise<AppliedDatabaseMigration[]> {
    return this.migrations.runMigrations();
  }
}
