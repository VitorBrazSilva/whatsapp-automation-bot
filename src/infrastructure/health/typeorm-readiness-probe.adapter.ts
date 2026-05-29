import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type { OperationalReadinessPort, ReadinessReport } from "../../application/index.js";

@Injectable()
export class TypeOrmReadinessProbeAdapter implements OperationalReadinessPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async read(): Promise<ReadinessReport> {
    const databaseReady = this.dataSource.isInitialized;
    return {
      status: databaseReady ? "ok" : "error",
      checks: {
        database: databaseReady ? "ok" : "error",
        whatsapp: "ok"
      }
    };
  }
}
