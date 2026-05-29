import { Controller, Get, Inject } from "@nestjs/common";
import type { OperationalReadinessPort, ReadinessReport } from "../../application/index.js";
import { READINESS_PROBE } from "./tokens.js";

interface LivenessResponse {
  status: "ok";
}

@Controller("health")
export class HealthController {
  constructor(
    @Inject(READINESS_PROBE)
    private readonly readiness: OperationalReadinessPort
  ) {}

  @Get("live")
  live(): LivenessResponse {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(): Promise<ReadinessReport> {
    return this.readiness.read();
  }
}
