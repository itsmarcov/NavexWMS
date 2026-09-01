import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { GenererTransitDto, ModifierProduitStationDto, ScanStationDto } from "./dto/station.dto";
import { StationService } from "./station.service";

type UtilisateurCourant = { sub: string; role: string; station_id?: string | null };

@Controller("station")
export class StationController {
  constructor(private readonly stationService: StationService) {}

  @Roles("agent_station", "admin")
  @Post("scan")
  scanner(
    @Body() dto: ScanStationDto,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.stationService.scanner(dto, user, req.ip);
  }

  @Roles("agent_station", "admin")
  @Get("decharges")
  listerDecharges(@CurrentUser() user: UtilisateurCourant) {
    return this.stationService.listerDecharges(user);
  }

  @Roles("agent_station", "admin")
  @Get("decharges/:id")
  detailDecharge(
    @Param("id") id: string,
    @CurrentUser() user: UtilisateurCourant,
  ) {
    return this.stationService.detailDecharge(id, user);
  }

  @Roles("agent_station", "admin")
  @Patch("decharges/:id/produits/:produitId")
  modifierProduit(
    @Param("id") id: string,
    @Param("produitId") produitId: string,
    @Body() dto: ModifierProduitStationDto,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.stationService.modifierProduit(id, produitId, dto, user, req.ip);
  }

  @Roles("agent_station", "admin")
  @Post("decharges/:id/generer-transit")
  genererTransit(
    @Param("id") id: string,
    @Body() dto: GenererTransitDto,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.stationService.genererTransit(id, dto, user, req.ip);
  }

  @Roles("agent_station", "admin")
  @Get("decharges/:id/etiquettes")
  preparerEtiquettes(
    @Param("id") id: string,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.stationService.preparerEtiquettes(id, user, req.ip);
  }
}
