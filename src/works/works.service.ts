import { Injectable } from '@nestjs/common';
import { TrinoService } from '../database/trino.service';

export interface WorkFilters {
  year?: number;
  domain?: string;
  field?: string;
  is_oa?: boolean;
  limit?: number;
  offset?: number;
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

@Injectable()
export class WorksService {
  constructor(private readonly trino: TrinoService) {}

  // ── list with optional filters ────────────────────────────
  async findAll(filters: WorkFilters = {}): Promise<Work[]> {
    const conditions: string[] = [];
    if (filters.year !== undefined)
      conditions.push(`publication_year = ${filters.year}`);
    if (filters.domain !== undefined)
      conditions.push(`domain = '${filters.domain}'`);
    if (filters.field !== undefined)
      conditions.push(`field = '${filters.field}'`);
    if (filters.is_oa !== undefined)
      conditions.push(`is_oa = ${filters.is_oa}`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 20;

    const sql = `SELECT id, title, publication_year, domain, field, cited_by_count, authors, is_oa, source_name FROM iceberg.scisci.works ${where} ORDER BY cited_by_count DESC LIMIT ${limit}`;

    return this.trino.query<Work>(sql);
  }

  // ── single work ───────────────────────────────────────────
  async findOne(id: string): Promise<Work | null> {
    const rows = await this.trino.query<Work>(`
      SELECT *
      FROM iceberg.scisci.works
      WHERE id = '${id}'
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  // ── paper count + avg citations per year ──────────────────
  async statsByYear(): Promise<YearStat[]> {
    return this.trino.query<YearStat>(`
      SELECT
        publication_year,
        COUNT(*)            AS paper_count,
        AVG(cited_by_count) AS avg_citations,
        SUM(cited_by_count) AS total_citations
      FROM iceberg.scisci.works
      WHERE publication_year IS NOT NULL
      GROUP BY publication_year
      ORDER BY publication_year ASC
    `);
  }

  // ── top domains ───────────────────────────────────────────
  async statsByDomain() {
    return this.trino.query(`
      SELECT
        domain,
        COUNT(*)            AS paper_count,
        AVG(cited_by_count) AS avg_citations
      FROM iceberg.scisci.works
      WHERE domain IS NOT NULL
      GROUP BY domain
      ORDER BY paper_count DESC
    `);
  }

  // ── open access % per year ────────────────────────────────
  async oaRatioByYear() {
    return this.trino.query(`
      SELECT
        publication_year,
        COUNT(*)                                               AS total,
        COUNT(CASE WHEN is_oa = true THEN 1 END)               AS oa_count,
        ROUND(100.0 * COUNT(CASE WHEN is_oa = true THEN 1 END)
              / COUNT(*), 1)                                   AS oa_pct
      FROM iceberg.scisci.works
      WHERE publication_year IS NOT NULL
      GROUP BY publication_year
      ORDER BY publication_year ASC
    `);
  }

  // ── co-authors of a work ──────────────────────────────────
  async coAuthors(workId: string) {
    return this.trino.query(`
      SELECT
        author_id,
        display_name,
        country_code,
        first_institution_name
      FROM iceberg.scisci.work_authors
      WHERE work_id = '${workId}'
    `);
  }
}
