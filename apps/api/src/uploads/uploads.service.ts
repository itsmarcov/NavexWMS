import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env, s3Configure } from "../env";

const EXTENSIONS_AUTORISEES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private client?: S3Client;

  private getClient(): S3Client {
    if (!s3Configure()) {
      throw new ServiceUnavailableException({ code: "erreurs.stockage_indisponible" });
    }
    if (!this.client) {
      this.client = new S3Client({
        endpoint: env.s3.endpoint,
        region: env.s3.region,
        forcePathStyle: env.s3.forcePathStyle,
        credentials: { accessKeyId: env.s3.accessKey, secretAccessKey: env.s3.secretKey },
      });
    }
    return this.client;
  }

  urlPublique(cle: string): string {
    if (env.s3.publicBaseUrl) return `${env.s3.publicBaseUrl.replace(/\/$/, "")}/${cle}`;
    const endpoint = env.s3.endpoint.replace(/\/$/, "");
    return env.s3.forcePathStyle
      ? `${endpoint}/${env.s3.bucket}/${cle}`
      : `${endpoint.replace("://", `://${env.s3.bucket}.`)}/${cle}`;
  }

  /** Téléverse un objet brut et renvoie son URL publique. */
  async televerserObjet(cle: string, corps: Buffer | Uint8Array, contentType: string): Promise<string> {
    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: cle,
          Body: corps,
          ContentType: contentType,
        }),
      );
      return this.urlPublique(cle);
    } catch (erreur) {
      this.logger.error(`Échec téléversement S3 (${cle}) : ${erreur instanceof Error ? erreur.message : erreur}`);
      throw new ServiceUnavailableException({ code: "erreurs.stockage_indisponible" });
    }
  }

  async televerserPhoto(fichier: Express.Multer.File): Promise<{ url: string }> {
    const extension = EXTENSIONS_AUTORISEES[fichier.mimetype];
    if (!extension) throw new ServiceUnavailableException({ code: "erreurs.type_fichier_refuse" });

    if (!s3Configure()) {
      const base64 = fichier.buffer.toString("base64");
      const url = `data:${fichier.mimetype};base64,${base64}`;
      return { url };
    }

    const cle = `photos/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const url = await this.televerserObjet(cle, fichier.buffer, fichier.mimetype);
    return { url };
  }
}
