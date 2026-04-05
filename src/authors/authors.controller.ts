import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AuthorsService } from './authors.service';
import { Author } from './author.entity';

@ApiTags('authors')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all unique authors with paper count' })
  @ApiResponse({ status: 200, description: 'List of unique authors' })
  getAll() {
    return this.authorsService.findAll();
  }

  @Get('paper/:paperId')
  @ApiOperation({ summary: 'Get all authors for a paper' })
  @ApiParam({ name: 'paperId', description: 'OpenAlex work ID', example: 'W2963403868' })
  @ApiResponse({ status: 200, description: 'List of authors for the paper', type: [Author] })
  getByPaper(@Param('paperId') paperId: string): Promise<Author[]> {
    return this.authorsService.findByPaper(paperId);
  }

  @Get(':authorId')
  @ApiOperation({ summary: 'Get all papers for an author' })
  @ApiParam({ name: 'authorId', description: 'OpenAlex author ID', example: 'A2963403001' })
  @ApiResponse({ status: 200, description: 'All paper-author records for this author', type: [Author] })
  getByAuthor(@Param('authorId') authorId: string): Promise<Author[]> {
    return this.authorsService.findByAuthor(authorId);
  }
}