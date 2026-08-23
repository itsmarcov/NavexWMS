import { IsIn } from "class-validator";

const STATUTS = ["en_attente", "actif", "suspendu"] as const;

export class StatutExpediteurDto {
  @IsIn(STATUTS as unknown as string[], { message: "erreurs.statut_invalide" })
  statut!: (typeof STATUTS)[number];
}
