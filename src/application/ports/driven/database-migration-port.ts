export interface AppliedDatabaseMigration {
  name: string;
  timestamp: number;
}

export interface DatabaseMigrationPort {
  runMigrations(): Promise<AppliedDatabaseMigration[]>;
}
