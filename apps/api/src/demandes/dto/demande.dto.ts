import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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
  @MaxLength(500)
  photo_url?: string | null;
}

export class CreeDemandeDto {
  @Type(() => CreeProduitDto)
  produits!: CreeProduitDto[];
}
