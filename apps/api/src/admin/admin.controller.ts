import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminService } from "./admin.service";
import { StatutExpediteurDto } from "./dto/admin.dto";

@Roles("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  stats() {
    return this.adminService.stats();
  }

  @Get("expediteurs")
  listerExpediteurs() {
    return this.adminService.listerExpediteurs();
  }

  /** Active / suspend / remet en attente un expéditeur. */
  @Patch("expediteurs/:id/statut")
  changerStatut(
    @Param("id") id: string,
    @Body() dto: StatutExpediteurDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.adminService.changerStatutExpediteur(id, dto, user.sub);
  }

  @Get("utilisateurs")
  listerUtilisateurs() {
    return this.adminService.listerUtilisateurs();
  }
}
