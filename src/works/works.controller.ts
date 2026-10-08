import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { WorksService } from './works.service';
import { WorksQueryDto } from './dto/works-query.dto';
import { ChartFilterDto, ScatterQueryDto } from './dto/chart-filter.dto';
import { AuthorsQueryDto } from './dto/authors-query.dto';
import { InstitutionsQueryDto } from './dto/institutions-query.dto';
import { MapQueryDto } from './dto/map-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';

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

  @Get()
  @ApiOperation({ summary: 'List works from the lakehouse, searched/filtered/paginated' })
  findAll(@Query() q: WorksQueryDto) {
    return this.works.findAll({
      search: q.search,
      year: q.year,
      yearFrom: q.yearFrom,
      yearTo: q.yearTo,
      domain: q.domain,
      field: q.field,
      is_oa: q.is_oa,
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
    });
  }

  @Get('fields')
  @ApiOperation({ summary: 'Distinct field values, for populating a filter dropdown' })
  fields() {
    return this.works.fields();
  }

  @Get('domains')
  @ApiOperation({ summary: 'Distinct domain values, for populating a filter dropdown' })
  domains() {
    return this.works.domains();
  }

  // Must come before the generic :id route below, or Nest matches "export" as a work id.
  @Get('export')
  @ApiOperation({ summary: 'Export the current filtered/sorted search as CSV' })
  async exportCsv(@Query() q: WorksQueryDto, @Res() res: Response) {
    const csv = await this.works.exportCsv({
      search: q.search,
      year: q.year,
      yearFrom: q.yearFrom,
      yearTo: q.yearTo,
      domain: q.domain,
      field: q.field,
      is_oa: q.is_oa,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="insyx-works-export.csv"');
    res.send(csv);
  }

  @Get('stats/by-year')
  statsByYear(@Query() q: ChartFilterDto) {
    return this.works.statsByYear(q);
  }

  @Get('stats/by-field')
  statsByField(@Query() q: ChartFilterDto) {
    return this.works.statsByField(q);
  }

  @Get('stats/scatter')
  scatterSample(@Query() q: ScatterQueryDto) {
    return this.works.scatterSample(q, q.limit);
  }

  @Get('stats/field-period')
  fieldPeriodStats(@Query() q: ChartFilterDto) {
    return this.works.fieldPeriodStats(q);
  }

  @Get('stats/oa-ratio')
  oaRatio(@Query() q: ChartFilterDto) {
    return this.works.oaRatioByYear(q);
  }

  // Must come before the generic :id route below, or Nest matches "authors" as a work id.
  @Get('authors')
  @ApiOperation({ summary: 'Search/list authors from the lakehouse, paginated' })
  searchAuthors(@Query() q: AuthorsQueryDto) {
    return this.works.searchAuthors({
      search: q.search,
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
    });
  }

  @Get('authors/:authorId')
  authorDetail(@Param('authorId') authorId: string) {
    return this.works.authorDetail(authorId);
  }

  @Get('institutions/map')
  @ApiOperation({ summary: 'LOD-scored institution map features for the globe' })
  institutionsMap(@Query() q: MapQueryDto) {
    return this.works.institutionsMap({
      zoom: q.zoom ?? 0,
      minLng: q.minLng ?? -180,
      minLat: q.minLat ?? -90,
      maxLng: q.maxLng ?? 180,
      maxLat: q.maxLat ?? 90,
    });
  }

  @Get('institutions/search')
  searchInstitutions(@Query() q: SearchQueryDto) {
    return this.works.searchInstitutions(q.q ?? '');
  }

  @Get('institutions/by-country')
  @ApiOperation({ summary: 'Total work count per country, for the 2D choropleth map' })
  institutionsByCountry() {
    return this.works.institutionsByCountry();
  }

  // Must come before the generic institutions/:id route below, or Nest matches "institutions" as an id.
  @Get('institutions')
  @ApiOperation({ summary: 'Search/list institutions from the lakehouse, paginated' })
  listInstitutions(@Query() q: InstitutionsQueryDto) {
    return this.works.listInstitutions({
      search: q.search,
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
    });
  }

  @Get('institutions/:id/works')
  institutionWorks(@Param('id') id: string) {
    return this.works.institutionWorks(id);
  }

  @Get('institutions/:id/authors')
  @ApiOperation({ summary: 'Authors affiliated with a given institution' })
  institutionAuthors(@Param('id') id: string) {
    return this.works.institutionAuthors(id);
  }

  // Must come after institutions/map, institutions/search, and institutions/:id/* above,
  // or Nest matches "map"/"search" as this route's :id instead.
  @Get('institutions/:id')
  @ApiOperation({ summary: 'Single institution detail' })
  getInstitution(@Param('id') id: string) {
    return this.works.getInstitution(id);
  }

  @Get(':id/institutions')
  @ApiOperation({ summary: 'Institutions affiliated with a work, including map coordinates' })
  workInstitutions(@Param('id') id: string) {
    return this.works.workInstitutions(id);
  }

  @Get(':id/co-authors')
  coAuthors(@Param('id') id: string) {
    return this.works.coAuthors(id);
  }

  @Get(':id/topics')
  workTopics(@Param('id') id: string) {
    return this.works.workTopics(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.works.findOne(id);
  }
}
