import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  entite_type: string;
  entite_id: string;
  action: string;
  utilisateur_id?: string | null;
  donnees_avant?: Prisma.InputJsonValue;
  donnees_apres?: Prisma.InputJsonValue;
  ip_adresse?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry) {
    return this.prisma.auditLog.create({
      data: {
        entite_type: entry.entite_type,
        entite_id: entry.entite_id,
        action: entry.action,
        utilisateur_id: entry.utilisateur_id ?? null,
        donnees_avant: entry.donnees_avant ?? Prisma.JsonNull,
        donnees_apres: entry.donnees_apres ?? Prisma.JsonNull,
        ip_adresse: entry.ip_adresse ?? null,
      },
    });
  }
}
