import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(expediteurId: string) {
    return this.prisma.catalogueProduit.findMany({
      where: { expediteur_id: expediteurId },
      orderBy: { sku_code: "asc" },
    });
  }

  async ajouter(expediteurId: string, dto: AjouterCatalogueDto) {
    return this.prisma.catalogueProduit.upsert({
      where: { expediteur_id_sku_code: { expediteur_id: expediteurId, sku_code: dto.sku_code } },
      create: { expediteur_id: expediteurId, ...dto },
      update: { ...dto },
    });
  }

  async supprimer(id: string) {
    return this.prisma.catalogueProduit.delete({ where: { id } });
  }
}
