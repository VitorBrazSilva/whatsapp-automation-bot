import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AutomationConfigModule } from "../config/index.js";
import { AutomationTargetEntity, WhatsappTargetEntity } from "../database/index.js";
import { TARGET_RESOLVER } from "./target-resolver.js";
import { TargetsService } from "./targets.service.js";

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
    }
  ],
  exports: [TargetsService, TARGET_RESOLVER]
})
export class TargetsModule {}
