import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Decharge, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import * as jwt from "jsonwebtoken";
import * as QRCode from "qrcode";
import puppeteer, { Browser } from "puppeteer";
import chromiumSparticuz from "@sparticuz/chromium";
import { AuditService } from "../audit/audit.service";
import { env, s3Configure } from "../env";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";

interface ContexteUtilisateur {
  role: string;
  sub: string;
  expediteur_id?: string | null;
}

type LanguePdf = "fr" | "ar";

@Injectable()
export class DechargesService implements OnApplicationShutdown, OnModuleInit {
  private readonly logger = new Logger(DechargesService.name);
  private navigateur?: Browser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Préchauffage : sur les petits instancias (plan gratuit), l'extraction et le
   * démarrage de Chromium prennent plus de 100 s — au-delà du délai du proxy.
   * On les fait en tâche de fond dès le boot pour qu'ils soient terminés
   * avant la première demande de PDF.
   */
  onModuleInit() {
    if (process.platform !== "win32") {
      this.obtenirNavigateur().catch((erreur) => {
        this.logger.warn(`Préchauffage Chromium échoué (nouvel essai à la demande) : ${erreur}`);
      });
    }
  }

  async onApplicationShutdown() {
    await this.navigateur?.close();
  }

  // ── Génération / récupération ────────────────────────────────

  /**
   * Génère la décharge d'une demande (≥1 produit approuvé requis).
   * Si une décharge émise et non expirée existe déjà, elle est renvoyée telle quelle ;
   * sinon le QR (token + nonce) est régénéré.
   */
  async genererOuRecuperer(demandeId: string, user: ContexteUtilisateur, ip?: string) {
    const demande = await this.chargerDemande(demandeId, user);

    if (!demande.produits.some((p) => p.statut_validation === "approuve")) {
      throw new ConflictException({ code: "erreurs.aucun_produit_approuve" });
    }

    const existante = demande.decharge;
    if (existante) {
      if (existante.statut === "scannee") {
        throw new ConflictException({ code: "erreurs.decharge_deja_scannee" });
      }
      const expiree = this.estExpiree(existante);
      if (existante.statut === "emise" && !expiree) return existante;
    }

    // Contenu du QR strictement limité à {decharge_id, exp, nonce} — jamais de données produit.
    const nonce = randomUUID();
    const expiration = Math.floor(Date.now() / 1000) + env.dechargeTtlHeures * 3600;
    const qrCode = await this.genererQrCode(this.prisma);

    const decharge = await this.prisma.$transaction(async (tx) => {
      let id = existante?.id;
      if (!id) {
        id = randomUUID();
        await tx.decharge.create({
          data: {
            id,
            demande_id: demande.id,
            numero_decharge: "__en_cours__",
            qr_token: "",
            qr_code: qrCode,
            nonce,
          },
        });
      }
      const numero = existante?.numero_decharge ?? (await this.genererNumero(tx));
      return tx.decharge.update({
        where: { id },
        data: {
          numero_decharge: numero,
          statut: "emise",
          nonce,
          qr_token: jwt.sign({ decharge_id: id, exp: expiration, nonce }, env.privateKey(), {
            algorithm: "RS256",
          }),
          qr_code: qrCode,
          date_generation: new Date(),
          pdf_url: null,
        },
      });
    });

    await this.audit.log({
      entite_type: "Decharge",
      entite_id: decharge.id,
      action: "GENERATION_DECHARGE",
      utilisateur_id: user.sub,
      donnees_apres: {
        numero: decharge.numero_decharge,
        demande: demande.reference,
        expire_le: new Date(expiration * 1000).toISOString(),
      },
      ip_adresse: ip,
    });

    return decharge;
  }

  /** PDF complet ; met en cache sur S3 si configuré. */
  async pdf(dechargeId: string, user: ContexteUtilisateur, ip?: string) {
    const decharge = await this.prisma.decharge.findUnique({
      where: { id: dechargeId },
      include: {
        demande: {
          include: {
            expediteur: true,
            produits: { where: { statut_validation: "approuve" }, orderBy: { sku_code: "asc" } },
          },
        },
      },
    });

    if (!decharge) throw new NotFoundException({ code: "erreurs.introuvable" });
    this.verifierAcces(decharge.demande.expediteur_id, user);

    const buffer = await this.construirePdf(decharge);

    if (!decharge.pdf_url && s3Configure()) {
      try {
        const url = await this.uploads.televerserObjet(
          `decharges/${decharge.numero_decharge}.pdf`,
          buffer,
          "application/pdf",
        );
        await this.prisma.decharge.update({ where: { id: decharge.id }, data: { pdf_url: url } });
      } catch (erreur) {
        // S3 indisponible : le PDF est tout de même servi en direct.
        this.logger.warn(`Cache S3 du PDF ignoré : ${erreur instanceof Error ? erreur.message : erreur}`);
      }
    }

    await this.audit.log({
      entite_type: "Decharge",
      entite_id: decharge.id,
      action: "TELECHARGEMENT_DECHARGE",
      utilisateur_id: user.sub,
      ip_adresse: ip,
    });

    return { buffer, nom_fichier: `${decharge.numero_decharge}.pdf` };
  }

  // ── Outils internes ──────────────────────────────────────────

  private async chargerDemande(demandeId: string, user: ContexteUtilisateur) {
    const demande = await this.prisma.demandeStockage.findUnique({
      where: { id: demandeId },
      include: {
        produits: { where: { statut_validation: "approuve" } },
        expediteur: true,
        decharge: true,
      },
    });
    if (!demande) throw new NotFoundException({ code: "erreurs.introuvable" });
    this.verifierAcces(demande.expediteur_id, user);
    return demande;
  }

  private verifierAcces(expediteurId: string, user: ContexteUtilisateur) {
    if (user.role === "expediteur" && user.expediteur_id !== expediteurId) {
      throw new ForbiddenException({ code: "erreurs.acces_refuse" });
    }
  }

  private estExpiree(decharge: Decharge): boolean {
    return decharge.date_generation.getTime() + env.dechargeTtlHeures * 3600 * 1000 < Date.now();
  }

  private async genererNumero(tx: Prisma.TransactionClient) {
    const annee = new Date().getFullYear();
    for (let tentative = 0; tentative < 5; tentative++) {
      const nb = await tx.decharge.count({
        where: { date_generation: { gte: new Date(`${annee}-01-01`), lt: new Date(`${annee + 1}-01-01`) } },
      });
      const numero = `DEC-${annee}-${String(nb + 1).padStart(5, "0")}`;
      const existe = await tx.decharge.findUnique({ where: { numero_decharge: numero }, select: { id: true } });
      if (!existe) return numero;
    }
    return `DEC-${annee}-${Date.now()}`;
  }

  private async genererQrCode(tx: Prisma.TransactionClient) {
    const CARACT = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let tentative = 0; tentative < 10; tentative++) {
      let code = "";
      for (let i = 0; i < 8; i++) code += CARACT[Math.floor(Math.random() * CARACT.length)];
      const existe = await tx.decharge.findUnique({ where: { qr_code: code }, select: { id: true } });
      if (!existe) return code;
    }
    return `QR${Date.now()}`.slice(0, 8);
  }

  // ── PDF ──────────────────────────────────────────────────────

  private async obtenirNavigateur(): Promise<Browser> {
    if (!this.navigateur || !this.navigateur.connected) {
      if (process.platform === "win32") {
        // Développement local : puppeteer utilise le Chromium de son cache.
        this.navigateur = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
      } else {
        // Production (Render/Linux) : Chromium embarqué avec ses bibliothèques système.
        chromiumSparticuz.setGraphicsMode = false;
        this.navigateur = await puppeteer.launch({
          headless: true,
          executablePath: await chromiumSparticuz.executablePath(),
          timeout: 120_000,
          protocolTimeout: 120_000,
          args: [
            ...chromiumSparticuz.args,
            "--no-sandbox",
            // Réduction mémoire pour les environnements restreints (plan gratuit).
            "--single-process",
            "--no-zygote",
            "--disable-software-rasterizer",
            "--js-flags=--max-old-space-size=96",
          ],
        });
      }
    }
    return this.navigateur;
  }

  private libelles(langue: LanguePdf): Record<string, string> {
    const fichier = path.join(__dirname, "..", "i18n", `${langue}.json`);
    return JSON.parse(fs.readFileSync(fichier, "utf8"));
  }

  private async construirePdf(decharge: Decharge & {
    demande: {
      reference: string;
      date_reception_prevue: Date | null;
      conditions_acceptee: boolean;
      expediteur: { nom_entreprise: string; email: string; telephone: string; adresse: string; langue_preferee: string };
      produits: Array<{
        sku_code: string;
        designation: string;
        longueur_cm: number;
        largeur_cm: number;
        hauteur_cm: number;
        poids_kg: number;
        fragile: boolean;
        type_emballage: string;
        quantite: number;
      }>;
    };
  }): Promise<Buffer> {
    const langue: LanguePdf = decharge.demande.expediteur.langue_preferee === "ar" ? "ar" : "fr";
    const t = this.libelles(langue);
    const rtl = langue === "ar";
    const fmtDate = new Intl.DateTimeFormat(rtl ? "ar-DZ" : "fr-FR", { dateStyle: "long" });
    const fmtDateTime = new Intl.DateTimeFormat(rtl ? "ar-DZ" : "fr-FR", { dateStyle: "long", timeStyle: "short" });

    const logoBase64 = fs.readFileSync(path.join(__dirname, "..", "assets", "logo.png")).toString("base64");
    // Jeton en query string : un JWT contient des points, invisibles au
    // middleware i18n s'ils figurent dans le chemin.
    const urlQr = `${env.appPublicUrl}/fr/scan?t=${decharge.qr_code}`;
    const qrDataUrl = await QRCode.toDataURL(urlQr, { margin: 3, width: 400, errorCorrectionLevel: "M" });

    const lignes = decharge.demande.produits
      .map(
        (p) => `<tr>
          <td>${echapper(p.sku_code)}</td>
          <td>${echapper(p.designation)}${p.fragile ? ` <span class="fragile">⚠ ${t.fragile}</span>` : ""}</td>
          <td class="num">${p.longueur_cm} × ${p.largeur_cm} × ${p.hauteur_cm}</td>
          <td class="num">${p.poids_kg}</td>
          <td>${echapper(p.type_emballage)}</td>
          <td class="num">${p.quantite}</td>
        </tr>`,
      )
      .join("");

    const police = rtl
      ? `<link rel="preconnect" href="https://fonts.googleapis.com">
         <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">`
      : "";
    const famillePolice = rtl ? "'Tajawal', sans-serif" : "Helvetica, Arial, sans-serif";

    const html = `<!doctype html>
<html lang="${langue}" dir="${rtl ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><style>
  body { font-family: ${famillePolice}; font-size: 12px; color: #1c1917; margin: 24px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 12px; }
  h1 { font-size: 20px; margin: 0; }
  .logo { height: 54px; }
  .meta { margin-top: 16px; display: flex; justify-content: space-between; gap: 24px; }
  .bloc { background: #f8fafc; border: 1px solid #e7e5e4; border-radius: 6px; padding: 10px 12px; min-width: 42%; }
  .bloc h2 { font-size: 11px; text-transform: uppercase; color: #78716c; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th { background: #0f172a; color: white; padding: 6px 8px; font-size: 11px; text-align: start; }
  td { border-bottom: 1px solid #e7e5e4; padding: 6px 8px; }
  .num { direction: ltr; text-align: end; }
  .fragile { color: #b45309; font-size: 10px; }
  .qr-zone { margin-top: 22px; display: flex; gap: 18px; align-items: center; background: #f8fafc; border: 1px dashed #a8a29e; border-radius: 6px; padding: 14px; }
  .qr-zone img { width: 160px; height: 160px; }
  .consigne { max-width: 60%; font-size: 11px; color: #44403c; }
  footer { margin-top: 26px; font-size: 10px; color: #a8a29e; text-align: center; border-top: 1px solid #e7e5e4; padding-top: 8px; }
</style></head>
<body>
  <header>
    <div>
      <h1>${t.titre}</h1>
      <div style="margin-top:4px"><strong>${t.numero} :</strong> ${decharge.numero_decharge}</div>
      <div><strong>${t.reference_demande} :</strong> ${decharge.demande.reference}</div>
    </div>
    <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Navex" />
  </header>

  <div class="meta">
    <div class="bloc">
      <h2>${t.expediteur}</h2>
      <div><strong>${t.entreprise} :</strong> ${echapper(decharge.demande.expediteur.nom_entreprise)}</div>
      <div><strong>${t.contact} :</strong> ${echapper(decharge.demande.expediteur.email)}</div>
      <div><strong>${t.telephone} :</strong> ${echapper(decharge.demande.expediteur.telephone)}</div>
      <div><strong>${t.adresse} :</strong> ${echapper(decharge.demande.expediteur.adresse)}</div>
    </div>
    <div class="bloc">
      <h2>&nbsp;</h2>
      <div><strong>${t.date_generation} :</strong> ${fmtDateTime.format(decharge.date_generation)}</div>
      ${decharge.demande.date_reception_prevue ? `<div><strong>${t.date_reception_prevue} :</strong> ${fmtDate.format(decharge.demande.date_reception_prevue)}</div>` : ""}
      <div><strong>${t.valide_jusqua} :</strong> ${fmtDateTime.format(new Date(Date.now() + env.dechargeTtlHeures * 3600 * 1000))}</div>
    </div>
  </div>

  <h2 style="font-size:14px;margin-top:22px">${t.produits}</h2>
  <table>
    <thead><tr>
      <th>${t.col_sku}</th><th>${t.col_designation}</th><th>${t.col_dimensions}</th>
      <th>${t.col_poids}</th><th>${t.col_emballage}</th><th>${t.col_quantite}</th>
    </tr></thead>
    <tbody>${lignes}</tbody>
  </table>

  <div style="margin-top:18px;border:1px solid ${decharge.demande.conditions_acceptee ? "#d6d3d1" : "#fbbf24"};border-radius:6px;padding:12px 14px;background:${decharge.demande.conditions_acceptee ? "#f8fafc" : "#fffbeb"}">
    ${decharge.demande.conditions_acceptee
      ? `<div style="font-size:11px;color:#16a34a;font-weight:700;margin-bottom:6px">✔ Conditions acceptées</div>`
      : `<div style="font-size:11px;color:#b45309;font-weight:700;margin-bottom:6px">⚠ Conditions non acceptées</div>`}
    <p style="margin:0;font-size:10px;color:#44403c;line-height:1.5">
      Je certifie que les informations communiquées sont exactes et reconnais que le volume des marchandises stockées doit être compatible avec mon volume d'expédition. J'accepte que NAVEX DELIVERY puisse appliquer les conditions de stockage prévues au contrat, notamment en cas de stock disproportionné, d'inactivité ou d'occupation excessive de l'espace de stockage.
    </p>
  </div>

  <div class="qr-zone">
    <img src="${qrDataUrl}" alt="QR" />
    <div class="consigne">${t.consigne_qr}</div>
  </div>

  <footer>${t.pied}</footer>
</body></html>`;

    const page = await (await this.obtenirNavigateur()).newPage();
    try {
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 90_000 });
      // Attend la fin du chargement des polices web (utile pour l'arabe), sans bloquer indéfiniment.
      await page.evaluate("() => document.fonts.ready").catch(() => undefined);
      const octets = await page.pdf({ format: "A4", printBackground: true, timeout: 90_000, margin: { top: "10mm", bottom: "10mm" } });
      return Buffer.from(octets);
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}

/** Petit utilitaire : échappement HTML basique. */
function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
