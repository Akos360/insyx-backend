import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorksService } from './works.service';
import { WorksQueryDto } from './dto/works-query.dto';
import { ChartFilterDto, ScatterQueryDto } from './dto/chart-filter.dto';
import { AuthorsQueryDto } from './dto/authors-query.dto';
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

  // GET /works?search=neural&year=2022&domain=Biology&is_oa=true&limit=50&offset=50&sortBy=citedByCount&sortDir=desc
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

  // ── authors ──────────────────────────────────────────────────────────
  // Declared before the generic `:id` route below — same-depth static paths
  // must come first or Nest would try to match "authors" as a work id.

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

  // ── institutions ─────────────────────────────────────────────────────

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

  @Get('institutions/:id/works')
  institutionWorks(@Param('id') id: string) {
    return this.works.institutionWorks(id);
  }

  @Get(':id/co-authors')
  coAuthors(@Param('id') id: string) {
    return this.works.coAuthors(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.works.findOne(id);
  }
}
