import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AutomationConfigModule } from "../infrastructure/config/index.js";
import {
  AutomationRunEntity,
  MessageDeliveryEntity,
  TypeOrmAutomationRunRepositoryAdapter,
  TypeOrmDeliveryLogService
} from "../infrastructure/index.js";
import { AUTOMATION_RUNNER, DELIVERY_LOG } from "./automation-contracts.js";
import { AutomationRegistryService } from "./automation-registry.service.js";
import { AutomationRunnerService } from "./automation-runner.service.js";

@Module({
  imports: [
    AutomationConfigModule,
    TypeOrmModule.forFeature([AutomationRunEntity, MessageDeliveryEntity])
  ],
  providers: [
    AutomationRegistryService,
    TypeOrmAutomationRunRepositoryAdapter,
    AutomationRunnerService,
    TypeOrmDeliveryLogService,
    {
      provide: AUTOMATION_RUNNER,
      useExisting: AutomationRunnerService
    },
    {
      provide: DELIVERY_LOG,
      useExisting: TypeOrmDeliveryLogService
    }
  ],
  exports: [AutomationRegistryService, AutomationRunnerService, AUTOMATION_RUNNER, DELIVERY_LOG]
})
export class AutomationModule {}
