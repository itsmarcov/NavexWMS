import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ToutesExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    const statut =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const corps =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            code: "erreurs.generique",
            ...(process.env.EXPOSE_ERREURS === "true"
              ? { detail: exception instanceof Error ? `${exception.message}\n${exception.stack}` : String(exception) }
              : {}),
          };

    if (statut >= 500) {
      this.logger.error(
        `Erreur ${statut}: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    res.status(statut).json(corps);
  }
}
