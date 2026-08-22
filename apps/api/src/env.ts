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
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  privateKey: () => lireCle("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH", "./keys/private.pem"),
  publicKey: () => lireCle("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_PATH", "./keys/public.pem"),
  accessTtlSeconds: parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? "900", 10),
  refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? "7", 10),
  // SameSite=None requis si front et API sont sur des domaines différents (ex. *.onrender.com)
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "none" | "strict",
};
