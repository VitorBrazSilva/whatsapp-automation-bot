import { Controller, Get, Header, Inject } from "@nestjs/common";
import { METRICS_REGISTRY, type MetricsRegistry } from "../../infrastructure/index.js";

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
