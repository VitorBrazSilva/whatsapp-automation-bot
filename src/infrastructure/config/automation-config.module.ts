import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { loadAppConfig, type AppConfig } from "./app-config.adapter.js";

export const APP_CONFIG = Symbol("APP_CONFIG");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => loadAppConfig(process.env as NodeJS.ProcessEnv) as unknown as Record<string, unknown>
      ]
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
