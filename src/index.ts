import { startProcess } from "./process.js";
import { JsonLogger, readErrorCode, readErrorMessage } from "./observability/index.js";

const logger = new JsonLogger();

try {
  await startProcess();
} catch (error) {
  logger.error({
    event: "app.start_failed",
    errorCode: readErrorCode(error),
    errorMessage: readErrorMessage(error)
  });
  process.exitCode = 1;
}
