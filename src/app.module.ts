import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorksModule } from './works/works.module';
import { AuthModule } from './auth/auth.module';

// Postgres here is only for the `users` table. synchronize:true is deliberate:
// Docker always sets NODE_ENV=production, so the usual synchronize guard would
// never create the table. Replace with a migration before real deployment.
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
    // Loose global default; auth endpoints throttle tighter via @Throttle in AuthController.
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
