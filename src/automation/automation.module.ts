import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AutomationConfigModule } from "../config/index.js";
import { AutomationRunEntity, MessageDeliveryEntity } from "../database/index.js";
import { AUTOMATION_RUNNER, DELIVERY_LOG } from "./automation-contracts.js";
import { AutomationRegistryService } from "./automation-registry.service.js";
import { AutomationRunnerService } from "./automation-runner.service.js";
import { TypeOrmDeliveryLogService } from "./delivery-log.service.js";

@Module({
  imports: [
    AutomationConfigModule,
    TypeOrmModule.forFeature([AutomationRunEntity, MessageDeliveryEntity])
  ],
  providers: [
    AutomationRegistryService,
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
