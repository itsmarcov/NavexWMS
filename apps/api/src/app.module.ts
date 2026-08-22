import { Controller, Get } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { Public } from "./auth/decorators/public.decorator";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { DechargesModule } from "./decharges/decharges.module";
import { DemandesModule } from "./demandes/demandes.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UploadsModule } from "./uploads/uploads.module";

@Controller()
export class AppController {
  @Public()
  @Get("health")
  health() {
    return { statut: "ok" };
  }
}

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, DemandesModule, UploadsModule, DechargesModule],
  controllers: [AppController],
})
export class AppModule {}
