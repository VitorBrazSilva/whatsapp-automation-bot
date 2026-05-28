import { runCheckTodayCommand } from "./check-today-command.js";

try {
  await runCheckTodayCommand();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "birthdays.check_today.failed",
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error."
    })
  );
  process.exitCode = 1;
}
