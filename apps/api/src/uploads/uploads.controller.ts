import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "../auth/decorators/roles.decorator";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Roles("expediteur")
  @Post("photos")
  @UseInterceptors(
    FileInterceptor("photo", {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
    }),
  )
  photo(@UploadedFile() fichier?: Express.Multer.File) {
    if (!fichier) throw new BadRequestException({ code: "erreurs.fichier_manquant" });
    return this.uploadsService.televerserPhoto(fichier);
  }
}
