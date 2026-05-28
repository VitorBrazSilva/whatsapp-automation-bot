import { runTargetsAddCommand } from "./targets-add-command.js";

try {
  await runTargetsAddCommand();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "targets.add.failed",
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error."
    })
  );
  process.exitCode = 1;
}
