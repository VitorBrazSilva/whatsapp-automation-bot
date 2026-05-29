import { Injectable, Module, OnApplicationShutdown } from "@nestjs/common";
import { InjectDataSource, TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, type Migration } from "typeorm";
import type { DatabaseMigrationPort } from "../application/index.js";
import {
  APP_CONFIG,
  AutomationConfigModule,
  type AppConfig
} from "../infrastructure/config/index.js";
import { DATABASE_MIGRATION_PORT } from "../infrastructure/tokens.js";
import { createTypeOrmOptions } from "./typeorm-options.js";

@Injectable()
export class DatabaseMigrationService implements DatabaseMigrationPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async runMigrations(): Promise<Migration[]> {
    return this.dataSource.runMigrations({ transaction: "each" });
  }
}

@Injectable()
class DatabaseShutdownService implements OnApplicationShutdown {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AutomationConfigModule],
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createTypeOrmOptions(config)
    })
  ],
  providers: [
    DatabaseMigrationService,
    DatabaseShutdownService,
    {
      provide: DATABASE_MIGRATION_PORT,
      useExisting: DatabaseMigrationService
    }
  ],
  exports: [DatabaseMigrationService, DATABASE_MIGRATION_PORT]
})
export class DatabaseModule {}
