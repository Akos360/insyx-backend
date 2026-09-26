import { BadRequestException, Injectable } from '@nestjs/common';
import { TrinoService } from '../database/trino.service';
import { CENTROIDS, MapQuery, maxCount, jitter, inBbox, emptyFC } from '../common/geo.util';

const LAKEHOUSE = 'iceberg.scisci';

export interface WorkFilters {
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  domain?: string;
  field?: string;
  is_oa?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: SortableColumn;
  sortDir?: 'asc' | 'desc';
}

export interface Work {
  id: string;
  title: string;
  publication_year: number;
  domain: string;
  field: string;
  cited_by_count: number;
  authors: string;
  is_oa: boolean;
  source_name: string;
}

export interface WorksPage {
  items: Work[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkDetail {
  id: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  publication_year: number;
  domain: string | null;
  field: string | null;
  subfield: string | null;
  primary_topic: string | null;
  keywords: string | null;
  cited_by_count: number;
  is_oa: boolean;
  oa_url: string | null;
  pdf_url: string | null;
  source_name: string | null;
  authors: string | null;
}

const SORTABLE_COLUMNS = {
  title: 'title',
  authors: 'authors',
  publicationYear: 'publication_year',
  field: 'field',
  citedByCount: 'cited_by_count',
} as const;

type SortableColumn = keyof typeof SORTABLE_COLUMNS;

export interface YearStat {
  publication_year: number;
  paper_count: number;
  avg_citations: number;
  total_citations: number;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function boundedLimit(value: number | undefined, fallback = 20, max = 200): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestException('limit must be a positive integer');
  }
  return Math.min(value, max);
}

function optionalYear(value: number | undefined, label = 'year'): number | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1800 || value > 2200) {
    throw new BadRequestException(`${label} must be an integer between 1800 and 2200`);
  }
  return value;
}

function boundedOffset(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestException('offset must be a non-negative integer');
  }
  return value;
}

function buildWorkConditions(filters: WorkFilters): string[] {
  const conditions: string[] = [];
  const year = optionalYear(filters.year);
  const yearFrom = optionalYear(filters.yearFrom, 'yearFrom');
  const yearTo = optionalYear(filters.yearTo, 'yearTo');

  if (year !== undefined) {
    conditions.push(`publication_year = ${year}`);
  }
  if (yearFrom !== undefined) {
    conditions.push(`publication_year >= ${yearFrom}`);
  }
  if (yearTo !== undefined) {
    conditions.push(`publication_year <= ${yearTo}`);
  }
  if (filters.domain !== undefined) {
    conditions.push(`domain = ${sqlString(filters.domain)}`);
  }
  if (filters.field !== undefined) {
    conditions.push(`field = ${sqlString(filters.field)}`);
  }
  if (filters.is_oa !== undefined) {
    conditions.push(`is_oa = ${filters.is_oa ? 'true' : 'false'}`);
  }
  if (filters.search) {
    const term = sqlString(`%${filters.search.trim()}%`);
    conditions.push(`(LOWER(title) LIKE LOWER(${term}) OR LOWER(abstract) LIKE LOWER(${term}))`);
  }
  return conditions;
}

@Injectable()
export class WorksService {
  constructor(private readonly trino: TrinoService) {}

  health() {
    return this.trino.health();
  }

  async summary() {
    const rows = await this.trino.query(`
      SELECT
        (SELECT COUNT(*) FROM ${LAKEHOUSE}.works)             AS works,
        (SELECT COUNT(*) FROM ${LAKEHOUSE}.authors)           AS authors,
        (SELECT COUNT(*) FROM ${LAKEHOUSE}.institutions)      AS institutions,
        (SELECT COUNT(*) FROM ${LAKEHOUSE}.citations)         AS citations,
        (SELECT COUNT(*) FROM ${LAKEHOUSE}.work_topics)       AS work_topics,
        (SELECT COUNT(*) FROM ${LAKEHOUSE}.provenance_events) AS provenance_events
    `);
    return rows[0] ?? {};
  }

  async findAll(filters: WorkFilters = {}): Promise<WorksPage> {
    const conditions = buildWorkConditions(filters);
    const limit = boundedLimit(filters.limit, 50);
    const offset = boundedOffset(filters.offset);
    const sortColumn = SORTABLE_COLUMNS[filters.sortBy ?? 'citedByCount'] ?? 'cited_by_count';
    const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sequential, not Promise.all: the shared TrinoService client cannot safely
    // run two overlapping queries at once (concurrent calls silently return empty rows).
    const items = await this.trino.query<Work>(`
      SELECT
        id,
        title,
        publication_year,
        domain,
        field,
        cited_by_count,
        authors,
        is_oa,
        source_name
      FROM ${LAKEHOUSE}.works
      ${where}
      ORDER BY ${sortColumn} ${sortDir}
      OFFSET ${offset} LIMIT ${limit}
    `);
    const countRows = await this.trino.query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM ${LAKEHOUSE}.works ${where}
    `);

    return { items, total: Number(countRows[0]?.total ?? 0), limit, offset };
  }

  async fields(): Promise<string[]> {
    const rows = await this.trino.query<{ field: string }>(`
      SELECT DISTINCT field
      FROM ${LAKEHOUSE}.works
      WHERE field IS NOT NULL
      ORDER BY field
      LIMIT 200
    `);
    return rows.map((r) => r.field);
  }

  async findOne(id: string): Promise<WorkDetail | null> {
    // Explicit column list, not SELECT * — the lakehouse `works` table also carries
    // large JSONB-as-string blobs (concepts_full, keywords_full, references_full,
    // related_full, full_authors_info) that no frontend consumer of this endpoint
    // (PaperPage, GlobePanel's WorkView) ever reads.
    const rows = await this.trino.query<WorkDetail>(`
      SELECT
        id, doi, title, abstract, publication_year, domain, field, subfield,
        primary_topic, keywords, cited_by_count, is_oa, oa_url, pdf_url,
        source_name, authors
      FROM ${LAKEHOUSE}.works
      WHERE id = ${sqlString(id)}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async statsByYear(filters: WorkFilters = {}): Promise<YearStat[]> {
    const conditions = buildWorkConditions(filters);
    conditions.push('publication_year IS NOT NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.trino.query<YearStat>(`
      SELECT
        publication_year,
        COUNT(*)            AS paper_count,
        AVG(cited_by_count) AS avg_citations,
        SUM(cited_by_count) AS total_citations
      FROM ${LAKEHOUSE}.works
      ${where}
      GROUP BY publication_year
      ORDER BY publication_year ASC
    `);
  }

  async statsByField(filters: WorkFilters = {}, limit?: number) {
    const conditions = buildWorkConditions(filters);
    conditions.push('field IS NOT NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.trino.query<{ field: string; paper_count: number; avg_citations: number }>(`
      SELECT
        field,
        COUNT(*)            AS paper_count,
        AVG(cited_by_count) AS avg_citations
      FROM ${LAKEHOUSE}.works
      ${where}
      GROUP BY field
      ORDER BY paper_count DESC
      LIMIT ${boundedLimit(limit, 20)}
    `);
  }

  async scatterSample(filters: WorkFilters = {}, limit?: number) {
    const conditions = buildWorkConditions(filters);
    conditions.push('publication_year IS NOT NULL');
    conditions.push('cited_by_count IS NOT NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.trino.query<{ publication_year: number; cited_by_count: number; title: string }>(`
      SELECT publication_year, cited_by_count, title
      FROM ${LAKEHOUSE}.works
      ${where}
      ORDER BY rand()
      LIMIT ${boundedLimit(limit, 500, 2000)}
    `);
  }

  async fieldPeriodStats(filters: WorkFilters = {}) {
    const conditions = buildWorkConditions(filters);
    conditions.push('field IS NOT NULL');
    conditions.push('publication_year IS NOT NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;
    const periodCase = `
      CASE
        WHEN publication_year BETWEEN 2012 AND 2015 THEN 0
        WHEN publication_year BETWEEN 2016 AND 2019 THEN 1
        WHEN publication_year BETWEEN 2020 AND 2023 THEN 2
      END`;
    const rows = await this.trino.query<{ field: string; period_index: number | null; paper_count: number }>(`
      SELECT field, ${periodCase} AS period_index, COUNT(*) AS paper_count
      FROM ${LAKEHOUSE}.works
      ${where}
      GROUP BY field, ${periodCase}
    `);
    return rows.filter((r) => r.period_index !== null);
  }

  async oaRatioByYear(filters: WorkFilters = {}) {
    const conditions = buildWorkConditions(filters);
    conditions.push('publication_year IS NOT NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.trino.query<{ publication_year: number; total: number; oa_count: number; oa_pct: number }>(`
      SELECT
        publication_year,
        COUNT(*) AS total,
        COUNT(CASE WHEN is_oa = true THEN 1 END) AS oa_count,
        ROUND(100.0 * COUNT(CASE WHEN is_oa = true THEN 1 END) / COUNT(*), 1) AS oa_pct
      FROM ${LAKEHOUSE}.works
      ${where}
      GROUP BY publication_year
      ORDER BY publication_year ASC
    `);
  }

  async coAuthors(workId: string) {
    return this.trino.query(`
      SELECT
        author_id,
        display_name,
        country_code,
        first_institution_name
      FROM ${LAKEHOUSE}.work_authors
      WHERE work_id = ${sqlString(workId)}
      ORDER BY display_name ASC
    `);
  }


  // ── authors ────────────────────────────────────────────────────────────

  async searchAuthors(params: {
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'displayName' | 'worksCount' | 'citedByCount';
    sortDir?: 'asc' | 'desc';
  }) {
    const conditions: string[] = [];
    if (params.search) {
      const term = sqlString(`%${params.search.trim()}%`);
      conditions.push(`LOWER(display_name) LIKE LOWER(${term})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = boundedLimit(params.limit, 50);
    const offset = boundedOffset(params.offset);
    const sortColumnMap = {
      displayName: 'display_name',
      worksCount: 'works_count',
      citedByCount: 'cited_by_count',
    } as const;
    const sortColumn = sortColumnMap[params.sortBy ?? 'worksCount'] ?? 'works_count';
    const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC';

    const items = await this.trino.query(`
      SELECT author_id, display_name, orcid, country_code, works_count, cited_by_count
      FROM ${LAKEHOUSE}.authors
      ${where}
      ORDER BY ${sortColumn} ${sortDir}
      OFFSET ${offset} LIMIT ${limit}
    `);
    const countRows = await this.trino.query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM ${LAKEHOUSE}.authors ${where}
    `);
    return { items, total: Number(countRows[0]?.total ?? 0), limit, offset };
  }

  async authorDetail(authorId: string) {
    const papers = await this.trino.query<{
      id: string;
      title: string;
      publication_year: number;
      field: string;
      domain: string;
      cited_by_count: number;
      is_oa: boolean;
      source_name: string;
      display_name: string;
      orcid: string;
      country_code: string;
      first_institution_name: string;
    }>(`
      SELECT
        w.id, w.title, w.publication_year, w.field, w.domain, w.cited_by_count, w.is_oa, w.source_name,
        wa.display_name, wa.orcid, wa.country_code, wa.first_institution_name
      FROM ${LAKEHOUSE}.work_authors wa
      JOIN ${LAKEHOUSE}.works w ON w.id = wa.work_id
      WHERE wa.author_id = ${sqlString(authorId)}
      ORDER BY w.publication_year DESC
    `);
    if (papers.length === 0) {
      return null;
    }
    const first = papers[0];
    return {
      authorId,
      displayName: first.display_name,
      orcid: first.orcid,
      countryCode: first.country_code,
      firstInstitutionName: first.first_institution_name,
      papers: papers.map((p) => ({
        id: p.id,
        title: p.title,
        publication_year: p.publication_year,
        field: p.field,
        domain: p.domain,
        cited_by_count: p.cited_by_count,
        is_oa: p.is_oa,
        source_name: p.source_name,
      })),
    };
  }

  // ── institutions ───────────────────────────────────────────────────────

  async institutionsMap(query: MapQuery) {
    const rows = await this.trino.query<{
      id: string;
      name: string;
      country_code: string;
      works_count: number;
      cited_by_count: number;
    }>(`
      SELECT institution_id AS id, display_name AS name, country_code, works_count, cited_by_count
      FROM ${LAKEHOUSE}.institutions
      WHERE display_name IS NOT NULL
    `);

    if (!rows.length) return emptyFC();

    const scored = rows
      .map((r) => {
        const wc = Number(r.works_count) || 0;
        const cc = Number(r.cited_by_count) || 0;
        return { ...r, rawScore: Math.log1p(wc) * 0.4 + Math.log1p(cc) * 0.6 };
      })
      .sort((a, b) => b.rawScore - a.rawScore);

    const maxRaw = scored.reduce((m, r) => Math.max(m, r.rawScore), 0) || 1;
    const limit = maxCount(query.zoom);

    const features = scored
      .map((r) => {
        const score = r.rawScore / maxRaw;
        const centroid = CENTROIDS[r.country_code] ?? [0, 0];
        const [jLat, jLng] = jitter(r.id);
        return { r, score, lat: centroid[0] + jLat, lng: centroid[1] + jLng };
      })
      .filter(({ lat, lng }) => inBbox(lat, lng, query))
      .slice(0, limit);

    return {
      type: 'FeatureCollection' as const,
      features: features.map(({ r, score, lat, lng }) => ({
        type: 'Feature' as const,
        id: r.id,
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        properties: {
          name: r.name,
          workCount: Number(r.works_count),
          citationCount: Number(r.cited_by_count),
          score,
          countryCode: r.country_code ?? '',
        },
      })),
    };
  }

  async searchInstitutions(q: string) {
    const term = sqlString(`%${q}%`);
    const rows = await this.trino.query<{
      id: string;
      name: string;
      country_code: string;
      works_count: number;
      cited_by_count: number;
    }>(`
      SELECT institution_id AS id, display_name AS name, country_code, works_count, cited_by_count
      FROM ${LAKEHOUSE}.institutions
      WHERE LOWER(display_name) LIKE LOWER(${term})
      ORDER BY works_count DESC
      LIMIT 20
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      countryCode: r.country_code ?? '',
      workCount: Number(r.works_count),
      citationCount: Number(r.cited_by_count),
    }));
  }

  async institutionWorks(institutionId: string) {
    return this.trino.query<Work>(`
      SELECT
        w.id, w.title, w.publication_year, w.domain, w.field, w.cited_by_count,
        w.authors, w.is_oa, w.source_name
      FROM ${LAKEHOUSE}.work_institutions wi
      JOIN ${LAKEHOUSE}.works w ON w.id = wi.work_id
      WHERE wi.institution_id = ${sqlString(institutionId)}
      GROUP BY w.id, w.title, w.publication_year, w.domain, w.field, w.cited_by_count, w.authors, w.is_oa, w.source_name
      ORDER BY w.cited_by_count DESC
    `);
  }
}
