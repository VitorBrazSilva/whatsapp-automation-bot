import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import type { AppConfig } from "../infrastructure/config/index.js";
import { BirthdayDeliveryEntity, PersonEntity } from "../infrastructure/index.js";
import { InitialWhatsappAutomationSchema1710000000000 } from "./migrations/1710000000000-initial-whatsapp-automation-schema.js";
import { BirthdayReminderSchema1720000000000 } from "./migrations/1720000000000-birthday-reminder-schema.js";
import { DropLegacyAutomationSchema1730000000000 } from "./migrations/1730000000000-drop-legacy-automation-schema.js";

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
    entities: [BirthdayDeliveryEntity, PersonEntity],
    migrations: [
      InitialWhatsappAutomationSchema1710000000000,
      BirthdayReminderSchema1720000000000,
      DropLegacyAutomationSchema1730000000000
    ]
  };
}
