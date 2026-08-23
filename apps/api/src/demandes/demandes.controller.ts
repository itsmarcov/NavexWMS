import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CreeDemandeDto } from "./dto/demande.dto";
import { DemandesService } from "./demandes.service";

@Controller("demandes")
export class DemandesController {
  constructor(private readonly demandesService: DemandesService) {}

  @Roles("expediteur")
  @Post()
  creer(
    @Body() dto: CreeDemandeDto,
    @CurrentUser() user: { sub: string; expediteur_id?: string | null },
    @Req() req: Request,
  ) {
    return this.demandesService.creer(user.expediteur_id ?? user.sub, user.sub, dto, req.ip);
  }

  @Roles("expediteur", "agent_commercial", "admin")
  @Get()
  lister(@CurrentUser() user: { role: "expediteur" | "agent_commercial" | "admin"; expediteur_id?: string | null }) {
    return this.demandesService.lister(user.role, user.expediteur_id);
  }

  @Roles("expediteur", "agent_commercial", "admin")
  @Get(":id")
  detail(
    @Param("id") id: string,
    @CurrentUser() user: { role: string; expediteur_id?: string | null },
  ) {
    return this.demandesService.detail(id, user.role as never, user.expediteur_id);
  }
}
