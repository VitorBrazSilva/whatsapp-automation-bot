import { runListGroupsCommand } from "../presentation/cli/index.js";

try {
  await runListGroupsCommand();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "whatsapp.list_groups.failed",
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error."
    })
  );
  process.exitCode = 1;
}
