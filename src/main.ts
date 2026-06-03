import "reflect-metadata";
import { startProcess } from "./process.js";
import { readErrorCode, readErrorMessage } from "./infrastructure/index.js";

try {
  await startProcess();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "app.start_failed",
      errorCode: readErrorCode(error),
      errorMessage: readErrorMessage(error)
    })
  );
  process.exitCode = 1;
}
