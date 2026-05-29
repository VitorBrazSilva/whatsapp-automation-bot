import { Inject, Injectable } from "@nestjs/common";
import { BIRTHDAY_MESSAGE_GENERATOR } from "../ai/index.js";
import {
  RunBirthdayAutomationUseCase,
  type DeliveryLogPort,
  type LoggerPort,
  type MessageGeneratorPort,
  type MetricsPort,
  type WhatsAppClientPort
} from "../application/index.js";
import {
  DELIVERY_LOG,
  type AutomationHandler,
  type AutomationRunInput,
  type AutomationRunResult,
  type DeliveryLog
} from "../automation/index.js";
import { BIRTHDAY_AUTOMATION_KEY } from "../domain/index.js";
import {
  APP_CONFIG,
  METRICS_REGISTRY,
  STRUCTURED_LOGGER,
  TypeOrmPersonRepository,
  type AppConfig
} from "../infrastructure/index.js";
import { TARGET_RESOLVER, type TargetResolver } from "../targets/index.js";
import { WHATSAPP_CLIENT } from "../whatsapp/index.js";

@Injectable()
export class BirthdayAutomationHandler implements AutomationHandler {
  readonly key = BIRTHDAY_AUTOMATION_KEY;
  private readonly useCase: RunBirthdayAutomationUseCase;

  constructor(
    @Inject(TypeOrmPersonRepository)
    people: TypeOrmPersonRepository,
    @Inject(TARGET_RESOLVER)
    targetResolver: TargetResolver,
    @Inject(DELIVERY_LOG)
    deliveryLog: DeliveryLog,
    @Inject(WHATSAPP_CLIENT)
    whatsappClient: WhatsAppClientPort,
    @Inject(BIRTHDAY_MESSAGE_GENERATOR)
    messageGenerator: MessageGeneratorPort,
    @Inject(APP_CONFIG)
    config: AppConfig,
    @Inject(STRUCTURED_LOGGER)
    logger: LoggerPort,
    @Inject(METRICS_REGISTRY)
    metrics: MetricsPort
  ) {
    this.useCase = new RunBirthdayAutomationUseCase({
      automationKey: this.key,
      timezone: config.timezone,
      people,
      targets: targetResolver,
      deliveries: createDeliveryLogPort(deliveryLog),
      whatsapp: whatsappClient,
      messageGenerator,
      logger,
      metrics
    });
  }

  async run(input: AutomationRunInput): Promise<AutomationRunResult> {
    return this.useCase.execute(input);
  }
}

function createDeliveryLogPort(deliveryLog: DeliveryLog): DeliveryLogPort {
  return {
    hasSent(input) {
      return deliveryLog.hasSent(input.automationKey, input.dedupeKey, input.targetJid);
    },
    findPriorMessages(input) {
      return deliveryLog.findSuccessfulMessages(
        input.automationKey,
        input.subjectRef,
        input.targetJid,
        input.limit
      );
    },
    record(input) {
      return deliveryLog.record(input);
    }
  };
}
