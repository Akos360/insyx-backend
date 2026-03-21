import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PapersService } from './papers.service';
import { Paper } from './paper.entity';

@ApiTags('papers')
@Controller('papers')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all papers' })
  @ApiResponse({ status: 200, description: 'List of all papers', type: [Paper] })
  getAll(): Promise<Paper[]> {
    return this.papersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a paper by ID' })
  @ApiParam({ name: 'id', description: 'OpenAlex work ID', example: 'W2963403868' })
  @ApiResponse({ status: 200, description: 'The paper', type: Paper })
  @ApiResponse({ status: 404, description: 'Paper not found' })
  async getById(@Param('id') id: string): Promise<Paper> {
    const paper = await this.papersService.findById(id);
    if (!paper) {
      throw new NotFoundException(`Paper with id "${id}" was not found`);
    }
    return paper;
  }
}
