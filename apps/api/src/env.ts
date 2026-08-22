import * as fs from "fs";

/**
 * Clés RSA : soit inline dans les variables d'environnement (Render, avec \n échappé),
 * soit via fichiers locaux générés par `pnpm gen:keys`.
 */
const lireCle = (varInline: string, varChemin: string, cheminDefaut: string): string => {
  const inline = process.env[varInline];
  if (inline) return inline.replace(/\\n/g, "\n");

  const path = process.env[varChemin] ?? cheminDefaut;
  if (!fs.existsSync(path)) {
    throw new Error(
      `Clé introuvable : définissez ${varInline} ou générez les fichiers via \`pnpm gen:keys\` (${path}).`,
    );
  }
  return fs.readFileSync(path, "utf8");
};

export const env = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  // Origines autorisées (CORS), séparées par des virgules
  webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  privateKey: () => lireCle("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH", "./keys/private.pem"),
  publicKey: () => lireCle("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_PATH", "./keys/public.pem"),
  accessTtlSeconds: parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? "900", 10),
  refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? "7", 10),
  // SameSite=None requis si front et API sont sur des domaines différents (ex. *.onrender.com)
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "none" | "strict",
  // URL publique de l'app (encodée dans les QR codes des décharges)
  appPublicUrl: process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
  // Durée de validité du QR d'une décharge
  dechargeTtlHeures: parseInt(process.env.DECHARGE_TTL_HEURES ?? "72", 10),
  // Stockage S3-compatible (MinIO en dev, ex. Cloudflare R2 en prod)
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "",
    accessKey: process.env.S3_ACCESS_KEY ?? "",
    secretKey: process.env.S3_SECRET_KEY ?? "",
    // Base URL publique de lecture du bucket (si différente de l'endpoint)
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  },
};

/** Le stockage S3 est-il configuré ? */
export const s3Configure = (): boolean =>
  Boolean(env.s3.endpoint && env.s3.bucket && env.s3.accessKey && env.s3.secretKey);
