import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { PositionnementDto, ReceptionDto, ScanQrDto } from "./dto/entrepot.dto";
import { EntrepotService } from "./entrepot.service";

type UtilisateurCourant = { sub: string; role: string };

@Roles("agent_entrepot", "admin")
@Controller("entrepot")
export class EntrepotController {
  constructor(private readonly entrepotService: EntrepotService) {}

  /** Scan du QR d'une décharge à l'arrivée du camion. */
  @Post("scan")
  scanner(@Body() dto: ScanQrDto, @CurrentUser() user: UtilisateurCourant, @Req() req: Request) {
    return this.entrepotService.scanner(dto, user, req.ip);
  }

  /** Décharges en cours de traitement (scannées). */
  @Get("decharges")
  listerDecharges() {
    return this.entrepotService.listerDecharges();
  }

  /** Détail d'une décharge : produits approuvés + timeline des mouvements. */
  @Get("decharges/:id")
  detailDecharge(@Param("id") id: string) {
    return this.entrepotService.detailDecharge(id);
  }

  /** Confirmation de la réception physique de la marchandise. */
  @Post("decharges/:id/reception")
  confirmerReception(
    @Param("id") id: string,
    @Body() dto: ReceptionDto,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.entrepotService.confirmerReception(id, dto, user, req.ip);
  }

  /** Emplacements (libres par défaut) pour le positionnement. */
  @Get("emplacements")
  listerEmplacements(@Query("libres") libres?: string) {
    return this.entrepotService.listerEmplacements(libres !== "0" && libres !== "false");
  }

  /** Positionne la marchandise reçue dans un emplacement libre. */
  @Post("decharges/:id/positionnement")
  positionner(
    @Param("id") id: string,
    @Body() dto: PositionnementDto,
    @CurrentUser() user: UtilisateurCourant,
    @Req() req: Request,
  ) {
    return this.entrepotService.positionner(id, dto, user, req.ip);
  }
}
