import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PapersModule } from './papers/papers.module';

@Module({
  imports: [PapersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
