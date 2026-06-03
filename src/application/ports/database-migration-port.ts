export interface AppliedDatabaseMigration {
  name: string;
}

export interface DatabaseMigrationPort {
  runMigrations(): Promise<AppliedDatabaseMigration[]>;
}

export interface RunDatabaseMigrationsUseCasePort {
  execute(): Promise<AppliedDatabaseMigration[]>;
}
