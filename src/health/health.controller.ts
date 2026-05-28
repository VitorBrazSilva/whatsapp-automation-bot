import { Controller, Get } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

interface HealthResponse {
  status: "ok" | "error";
  checks?: Record<string, "ok" | "error">;
}

@Controller("health")
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get("live")
  live(): HealthResponse {
    return { status: "ok" };
  }

  @Get("ready")
  ready(): HealthResponse {
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
