import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WorksController],
  providers: [WorksService],
})
export class WorksModule {}
