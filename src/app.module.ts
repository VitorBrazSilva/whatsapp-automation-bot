import { Module } from "@nestjs/common";
import { AiModule } from "./ai/index.js";
import { AutomationModule } from "./automation/index.js";
import { BirthdayAutomationModule } from "./birthday-automation/index.js";
import { AutomationConfigModule } from "./config/index.js";
import { DatabaseModule } from "./database/index.js";
import { HealthModule } from "./health/index.js";
import { ObservabilityModule } from "./observability/index.js";
import { TargetsModule } from "./targets/index.js";
import { WhatsappModule } from "./whatsapp/index.js";

@Module({
  imports: [
    AutomationConfigModule,
    DatabaseModule,
    ObservabilityModule,
    HealthModule,
    TargetsModule,
    WhatsappModule,
    AutomationModule,
    AiModule,
    BirthdayAutomationModule
  ]
})
export class AppModule {}
