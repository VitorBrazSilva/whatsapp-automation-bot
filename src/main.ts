import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { APP_CONFIG, type AppConfig } from "./config/index.js";

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableShutdownHooks();
  await app.listen(config.http.port, config.http.host);
}
