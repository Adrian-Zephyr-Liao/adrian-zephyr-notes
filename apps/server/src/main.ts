import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    credentials: true,
    origin: createAllowedOrigins(),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();

function createAllowedOrigins() {
  return [
    process.env.FRONTEND_ORIGIN ?? "http://localhost:3002",
    process.env.ADMIN_FRONTEND_ORIGIN ?? "http://localhost:3000",
  ];
}
