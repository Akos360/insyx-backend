import { BadRequestException, Injectable } from '@nestjs/common';
import { TrinoService } from '../database/trino.service';

const LAKEHOUSE = 'iceberg.scisci';

export interface WorkFilters {
  year?: number;
  domain?: string;
  field?: string;
  is_oa?: boolean;
  limit?: number;
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

function optionalYear(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1800 || value > 2200) {
    throw new BadRequestException('year must be an integer between 1800 and 2200');
  }
  return value;
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

  async findAll(filters: WorkFilters = {}): Promise<Work[]> {
    const conditions: string[] = [];
    const year = optionalYear(filters.year);
    const limit = boundedLimit(filters.limit);

    if (year !== undefined) {
      conditions.push(`publication_year = ${year}`);
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

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.trino.query<Work>(`
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
      ORDER BY cited_by_count DESC
      LIMIT ${limit}
    `);
  }

  async findOne(id: string): Promise<Record<string, unknown> | null> {
    const rows = await this.trino.query(`
      SELECT *
      FROM ${LAKEHOUSE}.works
      WHERE id = ${sqlString(id)}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async statsByYear(): Promise<YearStat[]> {
    return this.trino.query<YearStat>(`
      SELECT
        publication_year,
        COUNT(*)            AS paper_count,
        AVG(cited_by_count) AS avg_citations,
        SUM(cited_by_count) AS total_citations
      FROM ${LAKEHOUSE}.works
      WHERE publication_year IS NOT NULL
      GROUP BY publication_year
      ORDER BY publication_year ASC
    `);
  }

  async statsByDomain(limit?: number) {
    return this.trino.query(`
      SELECT
        domain,
        COUNT(*)            AS paper_count,
        AVG(cited_by_count) AS avg_citations
      FROM ${LAKEHOUSE}.works
      WHERE domain IS NOT NULL
      GROUP BY domain
      ORDER BY paper_count DESC
      LIMIT ${boundedLimit(limit, 20)}
    `);
  }

  async statsByInstitution(limit?: number) {
    return this.trino.query(`
      SELECT
        institution_id,
        MAX(institution_name) AS institution_name,
        MAX(country_code)     AS country_code,
        COUNT(DISTINCT work_id) AS paper_count
      FROM ${LAKEHOUSE}.work_institutions
      GROUP BY institution_id
      ORDER BY paper_count DESC
      LIMIT ${boundedLimit(limit, 20)}
    `);
  }

  async topicGrowth(limit?: number) {
    return this.trino.query(`
      SELECT
        publication_year,
        display_name AS topic,
        COUNT(DISTINCT work_id) AS paper_count,
        AVG(score) AS avg_score
      FROM ${LAKEHOUSE}.work_topics
      GROUP BY publication_year, display_name
      ORDER BY publication_year ASC, paper_count DESC
      LIMIT ${boundedLimit(limit, 100, 500)}
    `);
  }

  async citationAge(limit?: number) {
    return this.trino.query(`
      SELECT
        citation_age,
        COUNT(*) AS citation_count
      FROM ${LAKEHOUSE}.citations
      GROUP BY citation_age
      ORDER BY citation_age ASC
      LIMIT ${boundedLimit(limit, 100, 500)}
    `);
  }

  async oaRatioByYear() {
    return this.trino.query(`
      SELECT
        publication_year,
        COUNT(*) AS total,
        COUNT(CASE WHEN is_oa = true THEN 1 END) AS oa_count,
        ROUND(100.0 * COUNT(CASE WHEN is_oa = true THEN 1 END) / COUNT(*), 1) AS oa_pct
      FROM ${LAKEHOUSE}.works
      WHERE publication_year IS NOT NULL
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

  async documents(workId: string) {
    return this.trino.query(`
      SELECT
        document_id,
        source_system,
        landing_page_url,
        pdf_url,
        text_object_path,
        license,
        is_publicly_shareable,
        extraction_status
      FROM ${LAKEHOUSE}.documents
      WHERE work_id = ${sqlString(workId)}
      LIMIT 20
    `);
  }

  async text(workId: string) {
    const rows = await this.trino.query(`
      SELECT
        w.id,
        w.title,
        w.abstract,
        w.publication_year,
        w.source_name,
        d.document_id,
        d.source_system,
        d.landing_page_url,
        d.pdf_url,
        d.text_object_path,
        d.license,
        d.is_publicly_shareable,
        d.extraction_status
      FROM ${LAKEHOUSE}.works w
      LEFT JOIN ${LAKEHOUSE}.documents d ON d.work_id = w.id
      WHERE w.id = ${sqlString(workId)}
      LIMIT 20
    `);

    if (rows.length === 0) {
      return null;
    }

    const first = rows[0];
    return {
      id: first.id,
      title: first.title,
      abstract: first.abstract,
      publication_year: first.publication_year,
      source_name: first.source_name,
      note:
        'Current demo stores title and abstract in works. Real extracted full text should be stored in MinIO and referenced by text_object_path.',
      documents: rows.map((row) => ({
        document_id: row.document_id,
        source_system: row.source_system,
        landing_page_url: row.landing_page_url,
        pdf_url: row.pdf_url,
        text_object_path: row.text_object_path,
        license: row.license,
        is_publicly_shareable: row.is_publicly_shareable,
        extraction_status: row.extraction_status,
      })),
    };
  }

  async provenance(workId: string) {
    return this.trino.query(`
      SELECT
        event_id,
        entity_type,
        entity_id,
        source_system,
        source_record_id,
        source_url,
        license,
        payload_hash,
        pipeline_version,
        ingested_at,
        ingested_date
      FROM ${LAKEHOUSE}.provenance_events
      WHERE entity_type = 'work'
        AND entity_id = ${sqlString(workId)}
      ORDER BY ingested_at DESC
      LIMIT 20
    `);
  }
}
