import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  RunBirthdayReminderUseCase,
  type BirthdayDeliveryRepository,
  type BirthdayMessageGenerator,
  type PersonRepository,
  type WhatsAppGroupMessenger
} from "../../application/index.js";
import { DatabaseModule } from "../../database/index.js";
import { BirthdaySchedulerService } from "../../presentation/scheduler/index.js";
import { OpenAiMessageGeneratorAdapter } from "../ai/index.js";
import { APP_CONFIG, AppConfigModule, type AppConfig } from "../config/index.js";
import {
  BirthdayDeliveryEntity,
  PersonEntity,
  TypeOrmBirthdayDeliveryRepository,
  TypeOrmPersonRepository
} from "../persistence/typeorm/index.js";
import { BaileysWhatsAppClientAdapter } from "../whatsapp/index.js";
import {
  BIRTHDAY_MESSAGE_GENERATOR,
  RUN_BIRTHDAY_REMINDER_USE_CASE,
  WHATSAPP_CLIENT
} from "./tokens.js";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([BirthdayDeliveryEntity, PersonEntity])
  ],
  providers: [
    TypeOrmBirthdayDeliveryRepository,
    TypeOrmPersonRepository,
    {
      provide: BIRTHDAY_MESSAGE_GENERATOR,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): BirthdayMessageGenerator =>
        new OpenAiMessageGeneratorAdapter({
          apiKey: config.openAi.apiKey?.reveal(),
          model: config.openAi.model,
          timeoutMs: config.openAi.timeoutMs
        })
    },
    {
      provide: WHATSAPP_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): WhatsAppGroupMessenger =>
        new BaileysWhatsAppClientAdapter({
          authDir: config.whatsappAuthDir
        })
    },
    {
      provide: RUN_BIRTHDAY_REMINDER_USE_CASE,
      inject: [
        APP_CONFIG,
        TypeOrmPersonRepository,
        TypeOrmBirthdayDeliveryRepository,
        BIRTHDAY_MESSAGE_GENERATOR,
        WHATSAPP_CLIENT
      ],
      useFactory: (
        config: AppConfig,
        people: PersonRepository,
        deliveries: BirthdayDeliveryRepository,
        messageGenerator: BirthdayMessageGenerator,
        whatsapp: WhatsAppGroupMessenger
      ): RunBirthdayReminderUseCase =>
        new RunBirthdayReminderUseCase({
          timezone: config.timezone,
          groupJid: config.whatsappGroupId ?? "",
          people,
          deliveries,
          messageGenerator,
          whatsapp
        })
    },
    BirthdaySchedulerService
  ],
  exports: [RUN_BIRTHDAY_REMINDER_USE_CASE, WHATSAPP_CLIENT]
})
export class AppCompositionModule {}
