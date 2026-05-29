import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AutomationConfigModule } from "../infrastructure/config/index.js";
import {
  AutomationTargetEntity,
  TARGET_CONFIGURATION_PORT,
  TargetsService,
  WhatsappTargetEntity
} from "../infrastructure/index.js";
import { TARGET_RESOLVER } from "./target-resolver.js";

@Module({
  imports: [
    AutomationConfigModule,
    TypeOrmModule.forFeature([AutomationTargetEntity, WhatsappTargetEntity])
  ],
  providers: [
    TargetsService,
    {
      provide: TARGET_RESOLVER,
      useExisting: TargetsService
    },
    {
      provide: TARGET_CONFIGURATION_PORT,
      useExisting: TargetsService
    }
  ],
  exports: [TargetsService, TARGET_RESOLVER, TARGET_CONFIGURATION_PORT]
})
export class TargetsModule {}
