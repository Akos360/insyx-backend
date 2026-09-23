import { Module } from '@nestjs/common';
import { TrinoService } from './trino.service';
import { WorksService } from '../works/works.service';
import { WorksController } from '../works/works.controller';

@Module({
  providers: [TrinoService, WorksService],
  controllers: [WorksController],
  exports: [TrinoService, WorksService],
})
export class DatabaseModule {}
