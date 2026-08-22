import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "apps", "api", "keys");
mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

writeFileSync(join(outDir, "private.pem"), privateKey);
writeFileSync(join(outDir, "public.pem"), publicKey);
console.log("Clés RS256 générées dans apps/api/keys/ (privée + publique)");
