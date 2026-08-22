import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import { env } from "../../env";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { JwtPayload } from "../jwt-payload.interface";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const estPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (estPublic) return true;

    const request = context.switchToHttp().getRequest();
    const entete: string | undefined = request.headers.authorization;

    if (!entete?.startsWith("Bearer ")) {
      throw new UnauthorizedException({ code: "erreurs.acces_refuse" });
    }

    try {
      const payload = jwt.verify(entete.slice(7), env.publicKey(), {
        algorithms: ["RS256"],
      }) as JwtPayload;
      if (payload.type !== "access") throw new Error("mauvais type de token");
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({ code: "erreurs.acces_refuse" });
    }
  }
}
