import { Injectable, NotFoundException } from "@nestjs/common";
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
  photo_url?: string | null;
  categorie?: string | null;
}

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(expediteurId: string, q?: string, categorie?: string) {
    const where: Record<string, unknown> = { expediteur_id: expediteurId };
    if (q) {
      where.OR = [
        { sku_code: { contains: q, mode: "insensitive" } },
        { designation: { contains: q, mode: "insensitive" } },
      ];
    }
    if (categorie) {
      where.categorie = categorie;
    }
    return this.prisma.catalogueProduit.findMany({
      where,
      orderBy: [{ compteur_usage: "desc" }, { sku_code: "asc" }],
    });
  }

  async ajouter(expediteurId: string, dto: AjouterCatalogueDto) {
    return this.prisma.catalogueProduit.upsert({
      where: { expediteur_id_sku_code: { expediteur_id: expediteurId, sku_code: dto.sku_code } },
      create: { expediteur_id: expediteurId, ...dto },
      update: { ...dto },
    });
  }

  async modifier(id: string, expediteurId: string, dto: Partial<AjouterCatalogueDto>) {
    const existe = await this.prisma.catalogueProduit.findFirst({
      where: { id, expediteur_id: expediteurId },
    });
    if (!existe) throw new NotFoundException({ code: "erreurs.introuvable" });
    return this.prisma.catalogueProduit.update({ where: { id }, data: dto });
  }

  async supprimer(id: string, expediteurId: string) {
    const resultat = await this.prisma.catalogueProduit.deleteMany({
      where: { id, expediteur_id: expediteurId },
    });
    if (resultat.count === 0) throw new NotFoundException({ code: "erreurs.introuvable" });
  }

  async incrementerUsage(skuCodes: string[], expediteurId: string) {
    for (const sku of skuCodes) {
      await this.prisma.catalogueProduit.updateMany({
        where: { expediteur_id: expediteurId, sku_code: sku },
        data: { compteur_usage: { increment: 1 } },
      });
    }
  }
}
