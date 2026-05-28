import { Injectable, Module, OnApplicationShutdown } from "@nestjs/common";
import { InjectDataSource, TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, type Migration } from "typeorm";
import { APP_CONFIG, AutomationConfigModule, type AppConfig } from "../config/index.js";
import { createTypeOrmOptions } from "./typeorm-options.js";

@Injectable()
export class DatabaseMigrationService {
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
  providers: [DatabaseMigrationService, DatabaseShutdownService],
  exports: [DatabaseMigrationService]
})
export class DatabaseModule {}
