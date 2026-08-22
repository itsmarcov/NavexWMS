import { Controller, Get } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { Public } from "./auth/decorators/public.decorator";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { PrismaModule } from "./prisma/prisma.module";

@Controller()
export class AppController {
  @Public()
  @Get("health")
  health() {
    return { statut: "ok" };
  }
}

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
