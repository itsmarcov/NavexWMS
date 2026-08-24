import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

const STATUTS = ["en_attente", "actif", "suspendu"] as const;

export class StatutExpediteurDto {
  @IsIn(STATUTS as unknown as string[], { message: "erreurs.statut_invalide" })
  statut!: (typeof STATUTS)[number];
}

const ROLES_CREABLES = ["expediteur", "agent_commercial", "agent_entrepot"] as const;

export class CreerUtilisateurDto {
  @IsEmail({}, { message: "erreurs.email_invalide" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "erreurs.mot_de_passe_court" })
  mot_de_passe!: string;

  @IsIn(ROLES_CREABLES as unknown as string[], { message: "erreurs.role_invalide" })
  role!: (typeof ROLES_CREABLES)[number];

  @IsOptional()
  @IsString()
  expediteur_id?: string;
}

export class CreerExpediteurDto {
  @IsString()
  nom_entreprise!: string;

  @IsEmail({}, { message: "erreurs.email_invalide" })
  email!: string;

  @IsString()
  telephone!: string;

  @IsString()
  adresse!: string;

  @IsOptional()
  @IsString()
  langue_preferee?: string;
}

export class ModifierUtilisateurDto {
  @IsOptional()
  @IsEmail({}, { message: "erreurs.email_invalide" })
  email?: string;

  @IsOptional()
  @IsIn(ROLES_CREABLES as unknown as string[], { message: "erreurs.role_invalide" })
  role?: (typeof ROLES_CREABLES)[number];

  @IsOptional()
  @IsString()
  expediteur_id?: string | null;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: "erreurs.mot_de_passe_court" })
  mot_de_passe?: string;
}

export class ModifierExpediteurDto {
  @IsOptional()
  @IsString()
  nom_entreprise?: string;

  @IsOptional()
  @IsEmail({}, { message: "erreurs.email_invalide" })
  email?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  langue_preferee?: string;
}
