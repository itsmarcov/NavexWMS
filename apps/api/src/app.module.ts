import { Controller, Get } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { Public } from "./auth/decorators/public.decorator";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { DechargesModule } from "./decharges/decharges.module";
import { DemandesModule } from "./demandes/demandes.module";
import { EntrepotModule } from "./entrepot/entrepot.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UploadsModule } from "./uploads/uploads.module";

@Controller()
export class AppController {
  @Public()
  @Get("health")
  health() {
    return { statut: "ok", commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local" };
  }
}

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, DemandesModule, UploadsModule, DechargesModule, EntrepotModule, AdminModule],
  controllers: [AppController],
})
export class AppModule {}
