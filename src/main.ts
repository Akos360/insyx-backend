import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { forceHttps } from "./common/force-https.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(forceHttps);

  // Needed to read the httpOnly access/refresh cookies AuthController sets.
  app.use(cookieParser());

  // Swagger UI needs inline scripts/styles, so only those two CSP directives are relaxed.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "script-src": ["'self'", "'unsafe-inline'"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  // No enableImplicitConversion: it overrides DTOs' explicit @Transform decorators
  // with class-transformer's naive Boolean(value), where Boolean("false") is true.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Insyx API")
    .setDescription("Academic paper and author explorer API")
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);
  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
