import { Module } from '@nestjs/common';
import { TrinoService } from './trino.service';

@Module({
  providers: [TrinoService],
  exports: [TrinoService],
})
export class DatabaseModule {}
