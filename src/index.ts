import { startProcess } from "./process.js";

try {
  await startProcess();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "app.start_failed",
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error."
    })
  );
  process.exitCode = 1;
}
