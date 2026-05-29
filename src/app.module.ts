import { Module } from "@nestjs/common";
import { AppCompositionModule } from "./infrastructure/nest/index.js";

@Module({
  imports: [AppCompositionModule]
})
export class AppModule {}
