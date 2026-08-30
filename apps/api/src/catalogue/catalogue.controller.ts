import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ForbiddenException } from "@nestjs/common";
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
  photo_url?: string | null;
  categorie?: string | null;
}

@Controller("catalogue")
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get()
  @Roles("expediteur", "admin", "agent_commercial")
  lister(
    @CurrentUser() user: { expediteur_id?: string },
    @Query("q") q?: string,
    @Query("categorie") categorie?: string,
  ) {
    if (!user.expediteur_id) return [];
    return this.catalogueService.lister(user.expediteur_id, q, categorie);
  }

  @Post()
  @Roles("expediteur")
  ajouter(@CurrentUser() user: { expediteur_id?: string }, @Body() dto: AjouterCatalogueDto) {
    if (!user.expediteur_id) throw new ForbiddenException();
    return this.catalogueService.ajouter(user.expediteur_id, dto);
  }

  @Patch(":id")
  @Roles("expediteur")
  modifier(
    @Param("id") id: string,
    @CurrentUser() user: { expediteur_id?: string },
    @Body() dto: Partial<AjouterCatalogueDto>,
  ) {
    if (!user.expediteur_id) throw new ForbiddenException();
    return this.catalogueService.modifier(id, user.expediteur_id, dto);
  }

  @Delete(":id")
  @Roles("expediteur")
  supprimer(@Param("id") id: string, @CurrentUser() user: { expediteur_id?: string }) {
    if (!user.expediteur_id) throw new ForbiddenException();
    return this.catalogueService.supprimer(id, user.expediteur_id);
  }
}
