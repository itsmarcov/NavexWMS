import { Module } from "@nestjs/common";
import { EntrepotController } from "./entrepot.controller";
import { EntrepotService } from "./entrepot.service";

@Module({
  controllers: [EntrepotController],
  providers: [EntrepotService],
})
export class EntrepotModule {}
