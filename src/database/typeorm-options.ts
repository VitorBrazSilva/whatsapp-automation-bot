import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import type { AppConfig } from "../config/index.js";
import {
  AutomationRunEntity,
  AutomationTargetEntity,
  MessageDeliveryEntity,
  PersonEntity,
  WhatsappTargetEntity
} from "./entities/index.js";
import { InitialWhatsappAutomationSchema1710000000000 } from "./migrations/1710000000000-initial-whatsapp-automation-schema.js";

export function createTypeOrmOptions(config: AppConfig): TypeOrmModuleOptions {
  const databasePath = config.databasePath;
  const memoryDatabase = databasePath === ":memory:";
  if (!memoryDatabase) {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
  return {
    type: "sqljs",
    autoSave: !memoryDatabase,
    location: memoryDatabase ? undefined : databasePath,
    useLocalForage: false,
    synchronize: false,
    migrationsRun: false,
    entities: [
      AutomationRunEntity,
      AutomationTargetEntity,
      MessageDeliveryEntity,
      PersonEntity,
      WhatsappTargetEntity
    ],
    migrations: [InitialWhatsappAutomationSchema1710000000000]
  };
}
