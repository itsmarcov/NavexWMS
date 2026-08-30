import { Controller, Get, Post, Delete, Body, Param, ForbiddenException } from "@nestjs/common";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CatalogueService } from "./catalogue.service";

interface AjouterCatalogueDto {
  sku_code: string;
  designation: string;
  longueur_cm: number;
  largeur_cm: number;
  hauteur_cm: number;
  poids_kg: number;
  fragile?: boolean;
  type_emballage: "carton" | "palette" | "sac" | "autre";
}

@Controller("catalogue")
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get()
  @Roles("expediteur", "admin", "agent_commercial")
  lister(@CurrentUser() user: { expediteur_id?: string }) {
    if (!user.expediteur_id) return [];
    return this.catalogueService.lister(user.expediteur_id);
  }

  @Post()
  @Roles("expediteur")
  ajouter(@CurrentUser() user: { expediteur_id?: string }, @Body() dto: AjouterCatalogueDto) {
    if (!user.expediteur_id) throw new ForbiddenException();
    return this.catalogueService.ajouter(user.expediteur_id, dto);
  }

  @Delete(":id")
  @Roles("expediteur")
  supprimer(@Param("id") id: string, @CurrentUser() user: { expediteur_id?: string }) {
    if (!user.expediteur_id) throw new ForbiddenException();
    return this.catalogueService.supprimer(id, user.expediteur_id);
  }
}
