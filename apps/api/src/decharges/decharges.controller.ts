import { IsString, IsNotEmpty } from "class-validator";
import { Controller, Get, Header, Param, Post, Req, StreamableFile } from "@nestjs/common";
import type { Request } from "express";
import { Body } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { DechargesService } from "./decharges.service";

class GenereDechargeDto {
  @IsString()
  @IsNotEmpty()
  demande_id!: string;
}

interface ContexteJwt {
  sub: string;
  role: string;
  expediteur_id?: string | null;
}

@Roles("expediteur", "agent_commercial", "admin")
@Controller("decharges")
export class DechargesController {
  constructor(private readonly dechargesService: DechargesService) {}

  /** Génère (ou renvoie) la décharge d'une demande ayant au moins un produit approuvé. */
  @Post("generate")
  generer(
    @Body() dto: GenereDechargeDto,
    @CurrentUser() user: ContexteJwt,
    @Req() req: Request,
  ) {
    return this.dechargesService.genererOuRecuperer(dto.demande_id, user, req.ip);
  }

  /** Téléchargement du PDF ; généré à la volée si non mis en cache. */
  @Get(":id/pdf")
  @Header("Content-Type", "application/pdf")
  async telecharger(
    @Param("id") id: string,
    @CurrentUser() user: ContexteJwt,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const { buffer, nom_fichier } = await this.dechargesService.pdf(id, user, req.ip);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${nom_fichier}"`,
    });
  }
}
