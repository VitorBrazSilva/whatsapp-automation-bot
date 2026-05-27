import { loadAppConfig, type AppConfig } from "./config/index.js";
import { openSqliteDatabase, runMigrations, type SqliteDatabase } from "./database/index.js";
import { DefaultBirthdayService, type BirthdayService } from "./domain/index.js";
import {
  BaileysWhatsAppClient,
  OpenAiMessageGenerator,
  type MessageGenerator,
  type WhatsAppClient
} from "./integrations/index.js";
import {
  HttpMetricsServer,
  InMemoryMetricsRegistry,
  JsonLogger,
  nullMetricsRegistry,
  type MetricsRegistry,
  type MetricsServer,
  type StructuredLogger
} from "./observability/index.js";
import {
  SqliteBirthdayCheckRepository,
  SqliteDeliveryRepository,
  SqlitePersonRepository
} from "./repositories/index.js";
import { DefaultBirthdayScheduler, type BirthdayScheduler } from "./scheduler/index.js";

export interface CreateAppOptions {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  requireOperationalConfig?: boolean;
}

export interface AppRuntime {
  config: AppConfig;
  status: "ready";
  startedAt: Date;
}

export interface BirthdayBotRuntime extends AppRuntime {
  database: SqliteDatabase;
  birthdayService: BirthdayService;
  whatsappClient: WhatsAppClient;
  scheduler: BirthdayScheduler;
  logger: StructuredLogger;
  metrics: MetricsRegistry;
  metricsServer: MetricsServer | null;
  now(): Date;
  close(): Promise<void>;
}

export interface CreateBirthdayBotRuntimeOptions extends CreateAppOptions {
  database?: SqliteDatabase;
  whatsappClient?: WhatsAppClient;
  messageGenerator?: MessageGenerator;
  logger?: StructuredLogger;
  metrics?: MetricsRegistry;
  metricsServer?: MetricsServer | null;
  nowProvider?: () => Date;
  runDatabaseMigrations?: boolean;
}

export function createApp(options: CreateAppOptions = {}): AppRuntime {
  const config = loadAppConfig(options.env, {
    requireOperationalSecrets: options.requireOperationalConfig ?? false
  });
  const startedAt = options.now ?? new Date();
  return {
    config,
    status: "ready",
    startedAt
  };
}

export async function createBirthdayBotRuntime(
  options: CreateBirthdayBotRuntimeOptions = {}
): Promise<BirthdayBotRuntime> {
  const app = createApp(options);
  const groupId = requireWhatsappGroupId(app.config);
  const nowProvider = options.nowProvider ?? (() => new Date());
  const logger = options.logger ?? new JsonLogger();
  const metrics =
    options.metrics ??
    (app.config.metrics.enabled ? new InMemoryMetricsRegistry() : nullMetricsRegistry);
  const metricsServer =
    options.metricsServer === undefined
      ? createMetricsServer(app.config, metrics)
      : options.metricsServer;
  const database =
    options.database ?? (await openSqliteDatabase({ path: app.config.databasePath }));
  if (options.runDatabaseMigrations ?? true) {
    await runMigrations(database);
  }
  const whatsappClient =
    options.whatsappClient ??
    new BaileysWhatsAppClient({
      authDir: app.config.whatsappAuthDir,
      logger,
      metrics
    });
  const messageGenerator =
    options.messageGenerator ??
    new OpenAiMessageGenerator({
      apiKey: app.config.openAi.apiKey?.reveal(),
      model: app.config.openAi.model,
      timeoutMs: app.config.openAi.timeoutMs
    });
  const birthdayService = new DefaultBirthdayService({
    timezone: app.config.timezone,
    groupId,
    personRepository: new SqlitePersonRepository(database, nowProvider),
    birthdayCheckRepository: new SqliteBirthdayCheckRepository(database, nowProvider),
    deliveryRepository: new SqliteDeliveryRepository(database, nowProvider),
    messageGenerator,
    whatsappClient,
    logger,
    metrics
  });
  const scheduler = new DefaultBirthdayScheduler({
    service: birthdayService,
    timezone: app.config.timezone,
    dailyCheckTime: app.config.dailyCheckTime,
    now: nowProvider,
    logger
  });

  return {
    ...app,
    database,
    birthdayService,
    whatsappClient,
    scheduler,
    logger,
    metrics,
    metricsServer,
    now: nowProvider,
    async close() {
      await metricsServer?.stop();
      await scheduler.stop();
      await closeWhatsAppClient(whatsappClient);
      await database.save();
      database.close();
    }
  };
}

function createMetricsServer(config: AppConfig, metrics: MetricsRegistry): MetricsServer | null {
  if (!config.metrics.enabled) {
    return null;
  }
  return new HttpMetricsServer({
    registry: metrics,
    host: config.metrics.host,
    port: config.metrics.port
  });
}

function requireWhatsappGroupId(config: AppConfig): string {
  if (config.whatsappGroupId !== null) {
    return config.whatsappGroupId;
  }
  throw new Error("WHATSAPP_GROUP_ID is required to run birthday checks.");
}

async function closeWhatsAppClient(client: WhatsAppClient): Promise<void> {
  const maybeClosable = client as { close?: () => Promise<void> | void };
  await maybeClosable.close?.();
}
