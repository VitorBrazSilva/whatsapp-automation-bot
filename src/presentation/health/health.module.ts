import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/index.js";
import { TypeOrmReadinessProbeAdapter } from "../../infrastructure/index.js";
import { HealthController } from "./health.controller.js";
import { READINESS_PROBE } from "./tokens.js";

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [
    TypeOrmReadinessProbeAdapter,
    {
      provide: READINESS_PROBE,
      useExisting: TypeOrmReadinessProbeAdapter
    }
  ]
})
export class HealthModule {}
