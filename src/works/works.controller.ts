import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorksService } from './works.service';

@ApiTags('works (lakehouse)')
@Controller('works')
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check the Trino/Iceberg connection' })
  health() {
    return this.works.health();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Row counts across the lakehouse tables' })
  summary() {
    return this.works.summary();
  }

  // GET /works?search=neural&year=2022&domain=Biology&is_oa=true&limit=50&offset=50&sortBy=citedByCount&sortDir=desc
  @Get()
  @ApiOperation({ summary: 'List works from the lakehouse, searched/filtered/paginated' })
  findAll(
    @Query()
    q: {
      search?: string;
      year?: string;
      yearFrom?: string;
      yearTo?: string;
      domain?: string;
      field?: string;
      is_oa?: string;
      limit?: string;
      offset?: string;
      sortBy?: 'title' | 'authors' | 'publicationYear' | 'field' | 'citedByCount';
      sortDir?: 'asc' | 'desc';
    },
  ) {
    return this.works.findAll({
      search: q.search,
      year: q.year ? Number(q.year) : undefined,
      yearFrom: q.yearFrom ? Number(q.yearFrom) : undefined,
      yearTo: q.yearTo ? Number(q.yearTo) : undefined,
      domain: q.domain,
      field: q.field,
      is_oa: q.is_oa ? q.is_oa === 'true' : undefined,
      limit: q.limit ? Number(q.limit) : 50,
      offset: q.offset ? Number(q.offset) : 0,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
    });
  }

  @Get('fields')
  @ApiOperation({ summary: 'Distinct field values, for populating a filter dropdown' })
  fields() {
    return this.works.fields();
  }

  @Get('stats/by-year')
  statsByYear() {
    return this.works.statsByYear();
  }

  @Get('stats/by-domain')
  statsByDomain() {
    return this.works.statsByDomain();
  }

  @Get('stats/by-institution')
  statsByInstitution(@Query('limit') limit?: string) {
    return this.works.statsByInstitution(limit ? Number(limit) : undefined);
  }

  @Get('stats/topic-growth')
  topicGrowth(@Query('limit') limit?: string) {
    return this.works.topicGrowth(limit ? Number(limit) : undefined);
  }

  @Get('stats/citation-age')
  citationAge(@Query('limit') limit?: string) {
    return this.works.citationAge(limit ? Number(limit) : undefined);
  }

  @Get('stats/oa-ratio')
  oaRatio() {
    return this.works.oaRatioByYear();
  }

  @Get(':id/co-authors')
  coAuthors(@Param('id') id: string) {
    return this.works.coAuthors(id);
  }

  @Get(':id/documents')
  documents(@Param('id') id: string) {
    return this.works.documents(id);
  }

  @Get(':id/text')
  text(@Param('id') id: string) {
    return this.works.text(id);
  }

  @Get(':id/provenance')
  provenance(@Param('id') id: string) {
    return this.works.provenance(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.works.findOne(id);
  }
}
