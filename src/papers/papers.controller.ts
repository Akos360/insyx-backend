import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PapersService } from './papers.service';
import type { Paper } from './papers.service';

@Controller('papers')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Get()
  getAll(): Paper[] {
    return this.papersService.findAll();
  }

  @Get(':id')
  getById(@Param('id') id: string): Paper {
    const paper = this.papersService.findById(id);
    if (!paper) {
      throw new NotFoundException(`Paper with id "${id}" was not found`);
    }
    return paper;
  }
}
