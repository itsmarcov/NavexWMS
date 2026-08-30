import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  CreeDemandeDto,
  PlanifierReceptionDto,
  ValiderProduitDto,
} from "./dto/demande.dto";
import { DemandesService } from "./demandes.service";

type UtilisateurCourant = { sub: string; role: string; expediteur_id?: string | null };

@Controller("demandes")
export class DemandesController {
  constructor(private readonly demandesService: DemandesService) {}

  @Roles("expediteur")
  @Post()
  creer(
    @Body() dto: CreeDemandeDto,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.demandesService.creer(user.expediteur_id ?? user.sub, user.sub, dto, req.ip);
  }

  @Roles("expediteur", "agent_commercial", "admin")
  @Get()
  lister(
    @CurrentUser() user: UtilisateurCourant,
    @Query("attente") attente?: string,
  ) {
    return this.demandesService.lister(
      user.role as never,
      user.expediteur_id,
      attente === "1" || attente === "true",
    );
  }

  @Roles("expediteur", "agent_commercial", "admin")
  @Get(":id")
  detail(@Param("id") id: string, @CurrentUser() user: UtilisateurCourant) {
    return this.demandesService.detail(id, user.role as never, user.expediteur_id);
  }

  /** Décision produit — réservée à l'agent commercial (et à l'admin). */
  @Roles("agent_commercial", "admin")
  @Patch(":id/produits/:produitId/validation")
  validerProduit(
    @Param("id") id: string,
    @Param("produitId") produitId: string,
    @Body() dto: ValiderProduitDto,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.demandesService.validerProduit(id, produitId, user.sub, dto, req.ip);
  }

  /** Planification de la réception physique — agent commercial. */
  @Roles("agent_commercial", "admin")
  @Patch(":id/planification")
  planifier(
    @Param("id") id: string,
    @Body() dto: PlanifierReceptionDto,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.demandesService.planifierReception(id, user.sub, dto, req.ip);
  }

  @Roles("expediteur", "agent_commercial", "agent_entrepot", "admin")
  @Get(":id/historique")
  historique(@Param("id") id: string, @CurrentUser() user: UtilisateurCourant) {
    return this.demandesService.historique(id, user.role as never, user.expediteur_id);
  }
}
