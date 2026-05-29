import { Module } from "@nestjs/common";
import {
  APP_CONFIG,
  AutomationConfigModule,
  OpenAiMessageGeneratorAdapter,
  type AppConfig,
  type MessageGenerator
} from "../infrastructure/index.js";

export const BIRTHDAY_MESSAGE_GENERATOR = Symbol("BIRTHDAY_MESSAGE_GENERATOR");

@Module({
  imports: [AutomationConfigModule],
  providers: [
    {
      provide: BIRTHDAY_MESSAGE_GENERATOR,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): MessageGenerator =>
        new OpenAiMessageGeneratorAdapter({
          apiKey: config.openAi.apiKey?.reveal(),
          model: config.openAi.model,
          timeoutMs: config.openAi.timeoutMs
        })
    }
  ],
  exports: [BIRTHDAY_MESSAGE_GENERATOR]
})
export class AiModule {}
