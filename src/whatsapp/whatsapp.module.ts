import { Inject, Injectable, Module, OnApplicationShutdown } from "@nestjs/common";
import {
  APP_CONFIG,
  AutomationConfigModule,
  BaileysWhatsAppClientAdapter,
  METRICS_REGISTRY,
  ObservabilityModule,
  STRUCTURED_LOGGER,
  type AppConfig,
  type MetricsRegistry,
  type StructuredLogger,
  type WhatsAppClient
} from "../infrastructure/index.js";

export const WHATSAPP_CLIENT = Symbol("WHATSAPP_CLIENT");

@Injectable()
class WhatsappShutdownService implements OnApplicationShutdown {
  constructor(
    @Inject(WHATSAPP_CLIENT)
    private readonly client: WhatsAppClient
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await (this.client as { close?: () => Promise<void> | void }).close?.();
  }
}

@Module({
  imports: [AutomationConfigModule, ObservabilityModule],
  providers: [
    {
      provide: WHATSAPP_CLIENT,
      inject: [APP_CONFIG, STRUCTURED_LOGGER, METRICS_REGISTRY],
      useFactory: async (
        config: AppConfig,
        logger: StructuredLogger,
        metrics: MetricsRegistry
      ): Promise<WhatsAppClient> => {
        return new BaileysWhatsAppClientAdapter({
          authDir: config.whatsappAuthDir,
          logger,
          metrics
        });
      }
    },
    WhatsappShutdownService
  ],
  exports: [WHATSAPP_CLIENT]
})
export class WhatsappModule {}
