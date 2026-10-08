import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorksModule } from './works/works.module';
import { AuthModule } from './auth/auth.module';
import { User } from './users/user.entity';
import { CreateUsers1791450000000 } from './migrations/1791450000000-CreateUsers';
import { AlignUsers1791450000001 } from './migrations/1791450000001-AlignUsers';

// Application accounts stay in PostgreSQL; bibliometric data stays in Trino.
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
        entities: [User],
        migrations: [CreateUsers1791450000000, AlignUsers1791450000001],
        migrationsRun: true,
        synchronize: false,
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
