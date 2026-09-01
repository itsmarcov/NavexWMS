import { Injectable, UnauthorizedException, HttpException, HttpStatus } from "@nestjs/common";
import { Utilisateur } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import * as jwt from "jsonwebtoken";
import { AuditService } from "../audit/audit.service";
import { env } from "../env";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "./jwt-payload.interface";

export const REFRESH_COOKIE = "navex_refresh";

const MAX_FAILED = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface Tokens {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  private readonly failedAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const key = email.toLowerCase().trim();

    const entry = this.failedAttempts.get(key);
    if (entry && entry.resetAt > Date.now()) {
      if (entry.count >= MAX_FAILED) {
        await this.audit.log({
          entite_type: "Utilisateur",
          entite_id: email,
          action: "LOGIN_ECHEC",
          utilisateur_id: null,
          ip_adresse: ip,
          donnees_apres: { reason: "rate_limited" },
        });
        throw new HttpException({ code: "erreurs.trop_de_tentatives" }, HttpStatus.TOO_MANY_REQUESTS);
      }
    } else if (entry) {
      this.failedAttempts.delete(key);
    }
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
      include: { expediteur: true },
    });

    const motDePasseValide =
      utilisateur && utilisateur.actif && (await bcrypt.compare(password, utilisateur.password_hash));

    if (!utilisateur || !motDePasseValide) {
      const cur = this.failedAttempts.get(key);
      this.failedAttempts.set(key, {
        count: (cur?.count ?? 0) + 1,
        resetAt: Date.now() + WINDOW_MS,
      });

      await this.audit.log({
        entite_type: "Utilisateur",
        entite_id: utilisateur?.id ?? email,
        action: "LOGIN_ECHEC",
        utilisateur_id: utilisateur?.id ?? null,
        ip_adresse: ip,
      });
      throw new UnauthorizedException({ code: "erreurs.identifiants_invalides" });
    }

    const tokens = this.signerTokens(utilisateur);
    await this.stockerRefreshToken(tokens.refresh_token, utilisateur.id, ip);

    this.failedAttempts.delete(key);

    await this.audit.log({
      entite_type: "Utilisateur",
      entite_id: utilisateur.id,
      action: "LOGIN",
      utilisateur_id: utilisateur.id,
      donnees_apres: { role: utilisateur.role },
      ip_adresse: ip,
    });

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      utilisateur: this.exposerUtilisateur(utilisateur),
    };
  }

  async refresh(refreshToken: string | undefined, ip?: string) {
    if (!refreshToken) throw new UnauthorizedException({ code: "erreurs.acces_refuse" });

    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, env.publicKey(), { algorithms: ["RS256"] }) as JwtPayload;
    } catch {
      throw new UnauthorizedException({ code: "erreurs.acces_refuse" });
    }
    if (payload.type !== "refresh") throw new UnauthorizedException({ code: "erreurs.acces_refuse" });

    const hash = this.hasher(refreshToken);
    const enregistrement = await this.prisma.refreshToken.findUnique({ where: { token_hash: hash } });

    if (
      !enregistrement ||
      enregistrement.revoke_at ||
      enregistrement.expires_at < new Date() ||
      enregistrement.utilisateur_id !== payload.sub
    ) {
      throw new UnauthorizedException({ code: "erreurs.session_expiree" });
    }

    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
      include: { expediteur: true },
    });
    if (!utilisateur || !utilisateur.actif) {
      throw new UnauthorizedException({ code: "erreurs.acces_refuse" });
    }

    // Rotation : révocation de l'ancien, émission d'un nouveau couple.
    await this.prisma.refreshToken.update({
      where: { token_hash: hash },
      data: { revoke_at: new Date() },
    });

    const tokens = this.signerTokens(utilisateur);
    await this.stockerRefreshToken(tokens.refresh_token, utilisateur.id, ip);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      utilisateur: this.exposerUtilisateur(utilisateur),
    };
  }

  async logout(refreshToken: string | undefined, ip?: string) {
    if (refreshToken) {
      const hash = this.hasher(refreshToken);
      const enregistrement = await this.prisma.refreshToken.findUnique({
        where: { token_hash: hash },
      });
      if (enregistrement && !enregistrement.revoke_at) {
        await this.prisma.refreshToken.update({
          where: { token_hash: hash },
          data: { revoke_at: new Date() },
        });
        await this.audit.log({
          entite_type: "Utilisateur",
          entite_id: enregistrement.utilisateur_id,
          action: "LOGOUT",
          utilisateur_id: enregistrement.utilisateur_id,
          ip_adresse: ip,
        });
      }
    }
    return { ok: true };
  }

  async me(userId: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      include: { expediteur: true, station: true },
    });
    if (!utilisateur) throw new UnauthorizedException({ code: "erreurs.acces_refuse" });
    return this.exposerUtilisateur(utilisateur);
  }

  async marquerTourTermine(userId: string) {
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { tour_termine: true },
    });
    return { ok: true };
  }

  private signerTokens(utilisateur: Utilisateur): Tokens {
    const base = {
      sub: utilisateur.id,
      email: utilisateur.email,
      role: utilisateur.role,
      expediteur_id: utilisateur.expediteur_id,
    };
    const access_token = jwt.sign({ ...base, type: "access", jti: randomUUID() }, env.privateKey(), {
      algorithm: "RS256",
      expiresIn: env.accessTtlSeconds,
    });
    const refresh_token = jwt.sign({ ...base, type: "refresh", jti: randomUUID() }, env.privateKey(), {
      algorithm: "RS256",
      expiresIn: `${env.refreshTtlDays}d`,
    });
    return { access_token, refresh_token };
  }

  private async stockerRefreshToken(token: string, utilisateurId: string, ip?: string) {
    await this.prisma.refreshToken.create({
      data: {
        utilisateur_id: utilisateurId,
        token_hash: this.hasher(token),
        expires_at: new Date(Date.now() + env.refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });
    void ip;
  }

  private hasher(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private exposerUtilisateur(utilisateur: Utilisateur & { expediteur?: unknown; station?: unknown }) {
    return {
      id: utilisateur.id,
      email: utilisateur.email,
      role: utilisateur.role,
      expediteur_id: utilisateur.expediteur_id,
      station_id: utilisateur.station_id,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      telephone: utilisateur.telephone,
      tour_termine: utilisateur.tour_termine,
    };
  }
}
