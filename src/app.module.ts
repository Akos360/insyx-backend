import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorksModule } from './works/works.module';
import { AuthModule } from './auth/auth.module';

// The Trino lakehouse (WorksModule) remains the source of truth for every
// bibliometric endpoint. Postgres/TypeORM is registered here for exactly one
// thing: the `users` table (AuthModule/UsersModule) — an interim store on
// this repo's own Postgres container (docker-compose.yml), not insyx-database
// (the lakehouse repo, never touched). `synchronize: true` is deliberate: this
// app's own Docker image always sets NODE_ENV=production (see
// force-https.middleware.ts), so the usual `synchronize: NODE_ENV !== 'production'`
// guard would silently never create the table locally. This is a single-developer
// thesis project on its own throwaway Postgres — replace with a real migration
// before any real deployment.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5433),
        username: config.get<string>('DB_USER', 'insyx'),
        password: config.get<string>('DB_PASSWORD', 'insyx'),
        database: config.get<string>('DB_NAME', 'insyx'),
        ssl: config.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
    }),
    // Generous global default for a public read-only browsing API — tightened
    // sharply on the auth endpoints specifically (see AuthController's
    // per-route @Throttle).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    WorksModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
