import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class ScanStationDto {
  @IsString()
  qr_token!: string;
}

const EMBALLAGES = ["carton", "palette", "sac", "autre"] as const;

export class ModifierProduitStationDto {
  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantite?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  longueur_cm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  largeur_cm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  hauteur_cm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  poids_kg?: number;

  @IsOptional()
  @IsBoolean()
  fragile?: boolean;

  @IsOptional()
  @IsIn(EMBALLAGES as unknown as string[])
  type_emballage?: (typeof EMBALLAGES)[number];
}

export class GenererTransitDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
