import { createApp, type AppRuntime } from "./app.js";

export async function startProcess(): Promise<AppRuntime> {
  const app = createApp({ requireOperationalConfig: true });
  console.log(
    JSON.stringify({
      event: "app.started",
      status: app.status,
      timezone: app.config.timezone,
      dailyCheckTime: app.config.dailyCheckTime,
      databaseConfigured: app.config.databasePath.length > 0,
      whatsappAuthConfigured: app.config.whatsappAuthDir.length > 0,
      whatsappGroupConfigured: app.config.whatsappGroupId !== null,
      openAiConfigured: app.config.openAiApiKeyConfigured
    })
  );
  return app;
}
