import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PapersModule } from './papers/papers.module';
import { AuthorsModule } from './authors/authors.module';
import { Paper } from './papers/paper.entity';
import { Author } from './authors/author.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'insyx'),
        password: config.get<string>('DB_PASSWORD', 'insyx'),
        database: config.get<string>('DB_NAME', 'insyx'),
        entities: [Paper, Author],
        synchronize: true, // auto-creates tables in dev; disable in production
      }),
    }),
    PapersModule,
    AuthorsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
