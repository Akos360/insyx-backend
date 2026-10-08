import { BadRequestException, Injectable } from '@nestjs/common';
import { TrinoService } from '../database/trino.service';
import { MapQuery, maxCount, inBbox, emptyFC } from '../common/geo.util';

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

export interface Institution {
  id: string;
  name: string;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface WorkDetail {
  institutions: Institution[];
  id: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  publication_year: number;
  publication_date: string | null;
  type: string | null;
  language: string | null;
  domain: string | null;
  field: string | null;
  subfield: string | null;
  primary_topic: string | null;
  keywords: string | null;
  cited_by_count: number;
  referenced_works_count: number | null;
  is_oa: boolean;
  oa_url: string | null;
  pdf_url: string | null;
  license: string | null;
  source_name: string | null;
  source_type: string | null;
  num_authors: number | null;
  apc_usd: number | null;
  authors: string | null;
}

const SORTABLE_COLUMNS = {
  title: 'title',
  authors: 'authors',
  publicationYear: 'publication_year',
  field: 'field_name',
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

const EXPORT_ROW_CAP = 20_000;

function csvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /["\r\n,]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
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
    conditions.push(`field_name = ${sqlString(filters.field)}`);
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

    // Sequential, not Promise.all: concurrent queries on the shared TrinoService silently return empty rows.
    const items = await this.trino.query<Work>(`
      SELECT
        id,
        title,
        publication_year,
        domain,
        field_name AS field,
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
      SELECT DISTINCT field_name AS field
      FROM ${LAKEHOUSE}.works
      WHERE field_name IS NOT NULL
      ORDER BY field_name
      LIMIT 200
    `);
    return rows.map((r) => r.field);
  }

  async domains(): Promise<string[]> {
    const rows = await this.trino.query<{ domain: string }>(`
      SELECT DISTINCT domain
      FROM ${LAKEHOUSE}.works
      WHERE domain IS NOT NULL
      ORDER BY domain
      LIMIT 200
    `);
    return rows.map((r) => r.domain);
  }

  // Capped well under the lakehouse's full size — a CSV export is a one-shot in-memory
  // build (no streaming), and nobody needs more than this many rows in a spreadsheet.
  async exportCsv(filters: WorkFilters = {}): Promise<string> {
    const conditions = buildWorkConditions(filters);
    const sortColumn = SORTABLE_COLUMNS[filters.sortBy ?? 'citedByCount'] ?? 'cited_by_count';
    const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.trino.query<{
      title: string;
      authors: string;
      publication_year: number;
      domain: string | null;
      field: string | null;
      cited_by_count: number;
      is_oa: boolean;
      source_name: string | null;
    }>(`
      SELECT title, authors, publication_year, domain, field_name AS field, cited_by_count, is_oa, source_name
      FROM ${LAKEHOUSE}.works
      ${where}
      ORDER BY ${sortColumn} ${sortDir}
      LIMIT ${EXPORT_ROW_CAP}
    `);

    const header = ['Title', 'Authors', 'Year', 'Domain', 'Field', 'Citations', 'Open Access', 'Source'];
    const lines = rows.map((r) =>
      [
        csvCell(r.title),
        csvCell(r.authors),
        csvCell(r.publication_year),
        csvCell(r.domain),
        csvCell(r.field),
        csvCell(r.cited_by_count),
        r.is_oa ? 'Yes' : 'No',
        csvCell(r.source_name),
      ].join(','),
    );
    return [header.join(','), ...lines].join('\r\n');
  }

  async findOne(id: string): Promise<WorkDetail | null> {
    // Explicit columns, not SELECT *: the table also has large JSONB blob columns no frontend consumer reads.
    const rows = await this.trino.query<Omit<WorkDetail, 'institutions'>>(`
      SELECT
        w.id, w.doi, w.title, w.abstract, w.publication_year, w.publication_date,
        w.type, w.language, w.domain, w.field_name AS field, w.subfield,
        w.primary_topic, w.keywords, w.cited_by_count, w.referenced_works_count,
        w.is_oa, w.oa_url, w.pdf_url, d.license, w.source_name, w.source_type,
        w.num_authors, w.apc_usd, w.authors
      FROM ${LAKEHOUSE}.works w
      LEFT JOIN ${LAKEHOUSE}.documents d ON d.work_id = w.id
      WHERE w.id = ${sqlString(id)}
      LIMIT 1
    `);
    if (!rows[0]) return null;
    const institutions = await this.workInstitutions(id);
    return { ...rows[0], institutions };
  }

  async workInstitutions(workId: string): Promise<Institution[]> {
    return this.trino.query<Institution>(`
      SELECT DISTINCT i.institution_id AS id, i.display_name AS name,
        i.country_code, i.latitude, i.longitude
      FROM ${LAKEHOUSE}.work_institutions wi
      JOIN ${LAKEHOUSE}.institutions i ON i.institution_id = wi.institution_id
      WHERE wi.work_id = ${sqlString(workId)}
      ORDER BY name, id
    `);
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
    conditions.push('field_name IS NOT NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.trino.query<{ field: string; paper_count: number; avg_citations: number }>(`
      SELECT
        field_name AS field,
        COUNT(*)            AS paper_count,
        AVG(cited_by_count) AS avg_citations
      FROM ${LAKEHOUSE}.works
      ${where}
      GROUP BY field_name
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
    conditions.push('field_name IS NOT NULL');
    conditions.push('publication_year IS NOT NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;
    const periodCase = `
      CASE
        WHEN publication_year BETWEEN 2012 AND 2015 THEN 0
        WHEN publication_year BETWEEN 2016 AND 2019 THEN 1
        WHEN publication_year BETWEEN 2020 AND 2023 THEN 2
      END`;
    const rows = await this.trino.query<{ field: string; period_index: number | null; paper_count: number }>(`
      SELECT field_name AS field, ${periodCase} AS period_index, COUNT(*) AS paper_count
      FROM ${LAKEHOUSE}.works
      ${where}
      GROUP BY field_name, ${periodCase}
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

  async workTopics(workId: string) {
    return this.trino.query<{ topic_id: string; display_name: string; score: number }>(`
      SELECT topic_id, display_name, score
      FROM ${LAKEHOUSE}.work_topics
      WHERE work_id = ${sqlString(workId)}
      ORDER BY score DESC
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
        w.id, w.title, w.publication_year, w.field_name AS field, w.domain, w.cited_by_count, w.is_oa, w.source_name,
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

  async institutionsMap(query: MapQuery) {
    const rows = await this.trino.query<{
      id: string;
      name: string;
      country_code: string;
      works_count: number;
      cited_by_count: number;
      author_count: number;
      latitude: number | null;
      longitude: number | null;
    }>(`
      SELECT i.institution_id AS id, i.display_name AS name, i.country_code, i.works_count, i.cited_by_count,
        i.latitude, i.longitude, COALESCE(ac.author_count, 0) AS author_count
      FROM ${LAKEHOUSE}.institutions i
      LEFT JOIN (
        SELECT institution_id, COUNT(DISTINCT author_id) AS author_count
        FROM ${LAKEHOUSE}.work_institutions
        GROUP BY institution_id
      ) ac ON ac.institution_id = i.institution_id
      WHERE i.display_name IS NOT NULL
    `);

    if (!rows.length) return emptyFC();

    // Three-way weighted importance, used only to decide which institutions survive
    // the zoom-based LOD cutoff below — the individual metrics (not this combined
    // score) drive each visual encoding (bar footprint/height/color) on the frontend.
    const scored = rows
      .filter((r) =>
        r.latitude !== null && r.longitude !== null &&
        Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)) &&
        Math.abs(Number(r.latitude)) <= 90 && Math.abs(Number(r.longitude)) <= 180,
      )
      .map((r) => {
        const wc = Number(r.works_count) || 0;
        const ac = Number(r.author_count) || 0;
        const cc = Number(r.cited_by_count) || 0;
        return { ...r, rawScore: Math.log1p(wc) * 0.35 + Math.log1p(ac) * 0.3 + Math.log1p(cc) * 0.35 };
      })
      .sort((a, b) => b.rawScore - a.rawScore);

    const maxRaw = scored.reduce((m, r) => Math.max(m, r.rawScore), 0) || 1;
    const limit = maxCount(query.zoom);

    const features = scored
      .map((r) => {
        const score = r.rawScore / maxRaw;
        return { r, score, lat: Number(r.latitude), lng: Number(r.longitude) };
      })
      .filter(({ lat, lng }) => inBbox(lat, lng, query))
      .slice(0, limit);

    return {
      type: 'FeatureCollection' as const,
      features: features.map(({ r, score, lat, lng }) => {
        const workCount = Number(r.works_count);
        const authorCount = Number(r.author_count);
        const citationCount = Number(r.cited_by_count);
        return {
          type: 'Feature' as const,
          id: r.id,
          geometry: { type: 'Point' as const, coordinates: [lng, lat] },
          properties: {
            name: r.name,
            workCount,
            authorCount,
            citationCount,
            // Citations per work — the standard bibliometric impact measure, used
            // for the bar's color (falls back to 0 for a work-less institution
            // rather than dividing by zero).
            citationsPerWork: workCount > 0 ? citationCount / workCount : 0,
            score,
            countryCode: r.country_code ?? '',
          },
        };
      }),
    };
  }

  async institutionsByCountry() {
    const rows = await this.trino.query<{ country_code: string | null; work_count: number }>(`
      SELECT country_code, SUM(works_count) AS work_count
      FROM ${LAKEHOUSE}.institutions
      WHERE country_code IS NOT NULL
      GROUP BY country_code
    `);
    return rows
      .filter((r) => r.country_code)
      .map((r) => ({ countryCode: r.country_code as string, workCount: Number(r.work_count) || 0 }));
  }

  async listInstitutions(params: {
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'worksCount' | 'citedByCount';
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
      name: 'display_name',
      worksCount: 'works_count',
      citedByCount: 'cited_by_count',
    } as const;
    const sortColumn = sortColumnMap[params.sortBy ?? 'worksCount'] ?? 'works_count';
    const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC';

    const rows = await this.trino.query<{
      id: string;
      name: string;
      country_code: string | null;
      works_count: number;
      cited_by_count: number;
      author_count: number;
    }>(`
      SELECT i.institution_id AS id, i.display_name AS name, i.country_code, i.works_count, i.cited_by_count,
        COALESCE(ac.author_count, 0) AS author_count
      FROM ${LAKEHOUSE}.institutions i
      LEFT JOIN (
        SELECT institution_id, COUNT(DISTINCT author_id) AS author_count
        FROM ${LAKEHOUSE}.work_institutions
        GROUP BY institution_id
      ) ac ON ac.institution_id = i.institution_id
      ${where}
      ORDER BY ${sortColumn} ${sortDir}
      OFFSET ${offset} LIMIT ${limit}
    `);
    const countRows = await this.trino.query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM ${LAKEHOUSE}.institutions ${where}
    `);

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      countryCode: r.country_code ?? '',
      workCount: Number(r.works_count),
      authorCount: Number(r.author_count),
      citationCount: Number(r.cited_by_count),
    }));
    return { items, total: Number(countRows[0]?.total ?? 0), limit, offset };
  }

  async getInstitution(id: string) {
    const rows = await this.trino.query<{
      id: string;
      name: string;
      country_code: string | null;
      institution_type: string | null;
      homepage_url: string | null;
      ror: string | null;
      latitude: number | null;
      longitude: number | null;
      works_count: number;
      cited_by_count: number;
    }>(`
      SELECT institution_id AS id, display_name AS name, country_code, institution_type,
        homepage_url, ror, latitude, longitude, works_count, cited_by_count
      FROM ${LAKEHOUSE}.institutions
      WHERE institution_id = ${sqlString(id)}
      LIMIT 1
    `);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      countryCode: r.country_code,
      institutionType: r.institution_type,
      homepageUrl: r.homepage_url,
      ror: r.ror,
      latitude: r.latitude,
      longitude: r.longitude,
      workCount: Number(r.works_count),
      citationCount: Number(r.cited_by_count),
    };
  }

  async institutionAuthors(institutionId: string) {
    const rows = await this.trino.query<{
      author_id: string;
      display_name: string;
      orcid: string | null;
      country_code: string | null;
      works_count: number;
      cited_by_count: number;
    }>(`
      SELECT DISTINCT a.author_id, a.display_name, a.orcid, a.country_code, a.works_count, a.cited_by_count
      FROM ${LAKEHOUSE}.work_institutions wi
      JOIN ${LAKEHOUSE}.authors a ON a.author_id = wi.author_id
      WHERE wi.institution_id = ${sqlString(institutionId)}
      ORDER BY a.cited_by_count DESC
      LIMIT 200
    `);
    return rows;
  }

  async searchInstitutions(q: string) {
    const term = sqlString(`%${q}%`);
    const rows = await this.trino.query<{
      id: string;
      name: string;
      country_code: string;
      works_count: number;
      cited_by_count: number;
      latitude: number | null;
      longitude: number | null;
    }>(`
      SELECT institution_id AS id, display_name AS name, country_code, works_count, cited_by_count, latitude, longitude
      FROM ${LAKEHOUSE}.institutions
      WHERE LOWER(display_name) LIKE LOWER(${term})
      ORDER BY works_count DESC
      LIMIT 20
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      countryCode: r.country_code ?? '',
      latitude: r.latitude,
      longitude: r.longitude,
      workCount: Number(r.works_count),
      citationCount: Number(r.cited_by_count),
    }));
  }

  async institutionWorks(institutionId: string) {
    return this.trino.query<Work>(`
      SELECT
        w.id, w.title, w.publication_year, w.domain, w.field_name AS field, w.cited_by_count,
        w.authors, w.is_oa, w.source_name
      FROM ${LAKEHOUSE}.work_institutions wi
      JOIN ${LAKEHOUSE}.works w ON w.id = wi.work_id
      WHERE wi.institution_id = ${sqlString(institutionId)}
      GROUP BY w.id, w.title, w.publication_year, w.domain, w.field_name, w.cited_by_count, w.authors, w.is_oa, w.source_name
      ORDER BY w.cited_by_count DESC
    `);
  }
}
