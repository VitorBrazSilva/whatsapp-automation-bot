import { loadAppConfig } from "../config/index.js";
import { openSqliteDatabase, runMigrations } from "../database/index.js";

const config = loadAppConfig();
const database = await openSqliteDatabase({ path: config.databasePath });

try {
  const result = await runMigrations(database);
  console.log(`Database migrations applied: ${result.applied.length}`);
} finally {
  await database.save();
  database.close();
}
