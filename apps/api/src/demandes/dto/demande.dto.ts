import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const TYPES_EMBALLAGE = ["carton", "palette", "sac", "autre"] as const;

export class CreeProduitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku_code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  designation!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  longueur_cm!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  largeur_cm!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  hauteur_cm!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  poids_kg!: number;

  @IsBoolean()
  fragile!: boolean;

  @IsIn(TYPES_EMBALLAGE)
  type_emballage!: (typeof TYPES_EMBALLAGE)[number];

  @IsInt()
  @Min(1)
  quantite!: number;

  @IsOptional()
  @IsString()
  photo_url?: string | null;
}

export class CreeDemandeDto {
  @IsArray()
  @ArrayNotEmpty({ message: "erreurs.produits_requis" })
  @ValidateNested({ each: true })
  @Type(() => CreeProduitDto)
  produits!: CreeProduitDto[];

  @IsOptional()
  @IsBoolean()
  conditions_acceptee?: boolean;
}

const DECISIONS = ["approuve", "refuse"] as const;

export class ValiderProduitDto {
  @IsIn(DECISIONS, { message: "erreurs.decision_invalide" })
  statut_validation!: (typeof DECISIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commentaire?: string;
}

export class PlanifierReceptionDto {
  @IsDateString({}, { message: "erreurs.date_invalide" })
  date_reception_prevue!: string;
}
