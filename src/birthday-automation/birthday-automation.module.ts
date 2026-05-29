import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiModule } from "../ai/index.js";
import {
  AutomationModule,
  AutomationRegistryService,
  type AutomationHandler
} from "../automation/index.js";
import {
  AUTOMATION_WORKFLOW_REGISTRATION,
  BIRTHDAY_AUTOMATION_WORKFLOW,
  AutomationConfigModule,
  ObservabilityModule,
  PersonEntity,
  TypeOrmPersonRepository
} from "../infrastructure/index.js";
import { TargetsModule } from "../targets/index.js";
import { WhatsappModule } from "../whatsapp/index.js";
import { BirthdayAutomationHandler } from "./birthday-automation.handler.js";
import { BirthdaySchedulerService } from "../presentation/scheduler/index.js";

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
    {
      provide: BIRTHDAY_AUTOMATION_WORKFLOW,
      useExisting: BirthdayAutomationHandler
    },
    {
      provide: AUTOMATION_WORKFLOW_REGISTRATION,
      inject: [AutomationRegistryService, BIRTHDAY_AUTOMATION_WORKFLOW],
      useFactory: (registry: AutomationRegistryService, workflow: AutomationHandler): true => {
        registry.register(workflow);
        return true;
      }
    },
    BirthdaySchedulerService
  ],
  exports: [TypeOrmPersonRepository]
})
export class BirthdayAutomationModule {}
