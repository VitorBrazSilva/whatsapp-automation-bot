import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiModule } from "../ai/index.js";
import { AutomationModule } from "../automation/index.js";
import { AutomationConfigModule } from "../config/index.js";
import { PersonEntity } from "../database/index.js";
import { ObservabilityModule } from "../observability/index.js";
import { TargetsModule } from "../targets/index.js";
import { WhatsappModule } from "../whatsapp/index.js";
import { BirthdayAutomationHandler } from "./birthday-automation.handler.js";
import { BirthdayAutomationService } from "./birthday-automation.service.js";
import { BirthdaySchedulerService } from "./birthday-scheduler.service.js";
import { TypeOrmPersonRepository } from "./typeorm-person.repository.js";

@Module({
  imports: [
    AutomationConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([PersonEntity]),
    AutomationModule,
    AiModule,
    ObservabilityModule,
    TargetsModule,
    WhatsappModule
  ],
  providers: [
    TypeOrmPersonRepository,
    BirthdayAutomationHandler,
    BirthdayAutomationService,
    BirthdaySchedulerService
  ],
  exports: [BirthdayAutomationService, TypeOrmPersonRepository]
})
export class BirthdayAutomationModule {}
