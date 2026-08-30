import { Module } from "@nestjs/common";
import { CatalogueModule } from "../catalogue/catalogue.module";
import { DemandesController } from "./demandes.controller";
import { DemandesService } from "./demandes.service";

@Module({
  imports: [CatalogueModule],
  controllers: [DemandesController],
  providers: [DemandesService],
  exports: [DemandesService],
})
export class DemandesModule {}
