import { Body, Controller, Get, Patch, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { AuditService } from "../audit/audit.service";
import { env } from "../env";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { LoginDto } from "./dto/login.dto";
import { AuthService, REFRESH_COOKIE } from "./auth.service";
import { JwtPayload } from "./jwt-payload.interface";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const resultat = await this.authService.login(dto.email, dto.password, req.ip);
    this.definirCookieRefresh(res, resultat.refresh_token);
    return {
      access_token: resultat.access_token,
      utilisateur: resultat.utilisateur,
    };
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const resultat = await this.authService.refresh(refreshToken, req.ip);
    this.definirCookieRefresh(res, resultat.refresh_token);
    return {
      access_token: resultat.access_token,
      utilisateur: resultat.utilisateur,
    };
  }

  @Public()
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(refreshToken, req.ip);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return { ok: true };
  }

  @Get("me")
  async me(@CurrentUser("sub") userId: string) {
    return this.authService.me(userId);
  }

  @Patch("marquer-tour-termine")
  async marquerTourTermine(@CurrentUser("sub") userId: string) {
    return this.authService.marquerTourTermine(userId);
  }

  /** Journalise chaque appel à /me — utile pour tracer les accès en phase de recette. */
  @Get("session-check")
  sessionCheck(@CurrentUser() user: JwtPayload) {
    void this.audit.log({
      entite_type: "Utilisateur",
      entite_id: user.sub,
      action: "SESSION_CHECK",
      utilisateur_id: user.sub,
    });
    return { role: user.role };
  }

  private definirCookieRefresh(res: Response, token: string) {
    const crossDomain = env.cookieSameSite === "none";
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || crossDomain,
      sameSite: env.cookieSameSite,
      path: "/api/auth",
      maxAge: env.refreshTtlDays * 24 * 60 * 60 * 1000,
    });
  }
}
