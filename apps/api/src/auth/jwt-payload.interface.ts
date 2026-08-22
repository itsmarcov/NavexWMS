import { RoleUtilisateur } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleUtilisateur;
  expediteur_id?: string | null;
  type: "access" | "refresh";
  jti: string;
}
