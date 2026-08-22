import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ToutesExceptionsFilter } from "./common/toutes-exceptions.filter";
import { env } from "./env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.webOrigins, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ToutesExceptionsFilter());

  // Fail-fast : si les clés RS256 sont absentes/invalides, on plante au démarrage
  // plutôt que de répondre 500 à chaque login.
  void env.publicKey();

  await app.listen(env.port);
  console.log(`API Navex WMS démarrée sur http://localhost:${env.port}/api`);
  console.log(`Origines CORS autorisées : ${env.webOrigins.join(", ")}`);
}

bootstrap();
