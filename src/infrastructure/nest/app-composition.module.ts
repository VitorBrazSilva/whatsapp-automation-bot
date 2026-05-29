import { Module } from "@nestjs/common";
import { AiModule } from "../../ai/index.js";
import { AutomationModule } from "../../automation/index.js";
import { BirthdayAutomationModule } from "../../birthday-automation/index.js";
import { DatabaseModule } from "../../database/index.js";
import { HealthModule } from "../../presentation/health/index.js";
import { MetricsModule } from "../../presentation/metrics/index.js";
import { TargetsModule } from "../../targets/index.js";
import { WhatsappModule } from "../../whatsapp/index.js";
import { AutomationConfigModule } from "../config/index.js";
import { ObservabilityModule } from "../observability/index.js";

@Module({
  imports: [
    AutomationConfigModule,
    DatabaseModule,
    ObservabilityModule,
    MetricsModule,
    HealthModule,
    TargetsModule,
    WhatsappModule,
    AutomationModule,
    AiModule,
    BirthdayAutomationModule
  ]
})
export class AppCompositionModule {}
