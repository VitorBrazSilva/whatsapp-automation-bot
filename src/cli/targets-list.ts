import { runTargetsListCommand } from "./targets-list-command.js";

try {
  await runTargetsListCommand();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "targets.list.failed",
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error."
    })
  );
  process.exitCode = 1;
}
