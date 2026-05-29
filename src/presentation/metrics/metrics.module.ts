import { Module } from "@nestjs/common";
import { ObservabilityModule } from "../../infrastructure/index.js";
import { MetricsController } from "./metrics.controller.js";

@Module({
  imports: [ObservabilityModule],
  controllers: [MetricsController]
})
export class MetricsModule {}
