import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminService } from "./admin.service";
import { CreerExpediteurDto, CreerUtilisateurDto, ModifierExpediteurDto, ModifierUtilisateurDto, StatutExpediteurDto } from "./dto/admin.dto";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Admin uniquement ──────────────────────────────────────

  @Roles("admin")
  @Get("stats")
  stats() {
    return this.adminService.stats();
  }

  @Roles("admin")
  @Get("expediteurs")
  listerExpediteurs() {
    return this.adminService.listerExpediteurs();
  }

  @Roles("admin")
  @Patch("expediteurs/:id/statut")
  changerStatut(
    @Param("id") id: string,
    @Body() dto: StatutExpediteurDto,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.adminService.changerStatutExpediteur(id, dto, user.sub);
  }

  @Roles("admin")
  @Patch("expediteurs/:id")
  modifierExpediteur(
    @Param("id") id: string,
    @Body() dto: ModifierExpediteurDto,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.adminService.modifierExpediteur(id, dto, user.sub);
  }

  @Roles("admin")
  @Delete("expediteurs/:id")
  supprimerExpediteur(
    @Param("id") id: string,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.adminService.supprimerExpediteur(id, user.sub);
  }

  @Roles("admin")
  @Get("utilisateurs")
  listerUtilisateurs() {
    return this.adminService.listerUtilisateurs();
  }

  @Roles("admin")
  @Post("utilisateurs")
  creerUtilisateur(
    @Body() dto: CreerUtilisateurDto,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.adminService.creerUtilisateur(dto, user.role, user.sub);
  }

  @Roles("admin")
  @Patch("utilisateurs/:id")
  modifierUtilisateur(
    @Param("id") id: string,
    @Body() dto: ModifierUtilisateurDto,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.adminService.modifierUtilisateur(id, dto, user.sub);
  }

  @Roles("admin")
  @Delete("utilisateurs/:id")
  supprimerUtilisateur(
    @Param("id") id: string,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.adminService.supprimerUtilisateur(id, user.sub);
  }

  // ── Admin OU agent commercial ─────────────────────────────

  @Roles("admin", "agent_commercial")
  @Post("expediteurs")
  creerExpediteur(
    @Body() dto: CreerExpediteurDto,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.adminService.creerExpediteur(dto, user.role, user.sub);
  }
}
