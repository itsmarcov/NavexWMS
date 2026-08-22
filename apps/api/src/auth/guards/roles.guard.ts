import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleUtilisateur } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { JwtPayload } from "../jwt-payload.interface";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequis = this.reflector.getAllAndOverride<RoleUtilisateur[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rolesRequis || rolesRequis.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const payload = user as JwtPayload | undefined;

    if (!payload || !rolesRequis.includes(payload.role)) {
      throw new ForbiddenException({ code: "erreurs.acces_refuse" });
    }
    return true;
  }
}
