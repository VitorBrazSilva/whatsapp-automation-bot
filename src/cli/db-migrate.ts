import { runDbMigrateCommand } from "../presentation/cli/index.js";

try {
  await runDbMigrateCommand();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "database.migrations.failed",
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error."
    })
  );
  process.exitCode = 1;
}
