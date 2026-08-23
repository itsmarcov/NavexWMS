import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class ScanQrDto {
  @IsString()
  @IsNotEmpty({ message: "erreurs.qr_invalide" })
  qr_token!: string;
}

export class ReceptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PositionnementDto {
  @IsUUID(undefined, { message: "erreurs.emplacement_invalide" })
  emplacement_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
