import { Inject, Injectable, Module, OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, AutomationConfigModule, type AppConfig } from "../config/index.js";
import type { WhatsAppClient } from "../integrations/whatsapp-client.js";
import {
  METRICS_REGISTRY,
  ObservabilityModule,
  STRUCTURED_LOGGER,
  type MetricsRegistry,
  type StructuredLogger
} from "../observability/index.js";

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
        const { BaileysWhatsAppClient } =
          await import("../integrations/whatsapp/baileys-whatsapp-client.js");
        return new BaileysWhatsAppClient({
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
