import { Controller, Get, Param, Query } from '@nestjs/common';
import { WorksService } from './works.service';

@Controller('works')
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @Get('health')
  health() {
    return this.works.health();
  }

  @Get('summary')
  summary() {
    return this.works.summary();
  }

  // GET /works?year=2022&domain=Biology&is_oa=true&limit=20
  @Get()
  findAll(
    @Query()
    q: {
      year?: string;
      domain?: string;
      field?: string;
      is_oa?: string;
      limit?: string;
      offset?: string;
    },
  ) {
    return this.works.findAll({
      year: q.year ? Number(q.year) : undefined,
      domain: q.domain,
      field: q.field,
      is_oa: q.is_oa ? q.is_oa === 'true' : undefined,
      limit: q.limit ? Number(q.limit) : 20,
    });
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
