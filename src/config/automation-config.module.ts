import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { loadAppConfig, type AppConfig } from "./app-config.js";

export const APP_CONFIG = Symbol("APP_CONFIG");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) =>
        loadAppConfig(env as NodeJS.ProcessEnv) as unknown as Record<string, unknown>
    })
  ],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadAppConfig(process.env)
    }
  ],
  exports: [APP_CONFIG]
})
export class AutomationConfigModule {}
