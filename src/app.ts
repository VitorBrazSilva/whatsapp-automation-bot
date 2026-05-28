import { loadAppConfig, type AppConfig } from "./config/index.js";

export interface CreateAppOptions {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  requireOperationalConfig?: boolean;
}

export interface AppRuntime {
  config: AppConfig;
  status: "ready";
  startedAt: Date;
}

export function createApp(options: CreateAppOptions = {}): AppRuntime {
  const config = loadAppConfig(options.env, {
    requireOperationalSecrets: options.requireOperationalConfig ?? false
  });
  const startedAt = options.now ?? new Date();
  return {
    config,
    status: "ready",
    startedAt
  };
}
