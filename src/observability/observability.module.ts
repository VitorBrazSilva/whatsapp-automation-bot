import { Controller, Get, Header, Inject, Module } from "@nestjs/common";
import { APP_CONFIG, AutomationConfigModule, type AppConfig } from "../config/index.js";
import { JsonLogger, type StructuredLogger } from "./logger.js";
import { InMemoryMetricsRegistry, nullMetricsRegistry, type MetricsRegistry } from "./metrics.js";

export const STRUCTURED_LOGGER = Symbol("STRUCTURED_LOGGER");
export const METRICS_REGISTRY = Symbol("METRICS_REGISTRY");

@Controller("metrics")
export class MetricsController {
  constructor(
    @Inject(METRICS_REGISTRY)
    private readonly metrics: MetricsRegistry
  ) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  renderMetrics(): string {
    return this.metrics.renderPrometheus();
  }
}

@Module({
  imports: [AutomationConfigModule],
  controllers: [MetricsController],
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
