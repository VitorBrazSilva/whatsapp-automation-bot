import { Module } from "@nestjs/common";
import { APP_CONFIG, AutomationConfigModule, type AppConfig } from "../config/index.js";
import { JsonLogger, type StructuredLogger } from "./logger.adapter.js";
import {
  InMemoryMetricsRegistry,
  nullMetricsRegistry,
  type MetricsRegistry
} from "./metrics.adapter.js";

export const STRUCTURED_LOGGER = Symbol("STRUCTURED_LOGGER");
export const METRICS_REGISTRY = Symbol("METRICS_REGISTRY");

@Module({
  imports: [AutomationConfigModule],
  providers: [
    {
      provide: STRUCTURED_LOGGER,
      useFactory: (): StructuredLogger => new JsonLogger()
    },
    {
      provide: METRICS_REGISTRY,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): MetricsRegistry =>
        config.metrics.enabled ? new InMemoryMetricsRegistry() : nullMetricsRegistry
    }
  ],
  exports: [STRUCTURED_LOGGER, METRICS_REGISTRY]
})
export class ObservabilityModule {}
