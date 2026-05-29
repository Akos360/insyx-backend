import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'insyx',
  password: process.env.DB_PASSWORD || 'insyx',
  database: process.env.DB_NAME || 'insyx',
};

const JSON_PATH = path.resolve(__dirname, '../../data/ai_subfield_100k_all_columns.json');
const BATCH_SIZE = 500;

function toInt(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

function toFloat(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function toBool(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  return String(val).toLowerCase() === 'yes' || String(val) === 'true' || String(val) === '1';
}

// Parse "author_id, orcid, display_name, inst_id, inst_name; ..." into author rows
function parseAuthorsInfo(
  raw: string | null,
  paperId: string,
  publicationYear: number | null,
  publicationDate: string | null,
): AuthorRow[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((entry) => {
      const parts = entry.split(',').map((p) => p.trim());
      const authorId = parts[0] || null;
      const orcid = parts[1] || null;
      const displayName = parts[2] || null;
      const instId = parts[3] || null;
      const instName = parts[4] || null;
      return {
        paperId,
        authorId: authorId || `${paperId}_unknown_${Math.random()}`,
        displayName,
        orcid: orcid || null,
        firstInstitutionId: instId || null,
        firstInstitutionName: instName || null,
        countryCode: null,
        institutionsFull: null,
        institutionsRaw: null,
        publicationYear,
        publicationDate,
      };
    })
    .filter((a) => a.authorId && !a.authorId.startsWith(paperId + '_unknown_'));
}

interface AuthorRow {
  paperId: string;
  authorId: string;
  displayName: string | null;
  orcid: string | null;
  firstInstitutionId: string | null;
  firstInstitutionName: string | null;
  countryCode: string | null;
  institutionsFull: any;
  institutionsRaw: any;
  publicationYear: number | null;
  publicationDate: string | null;
}

async function insertWorks(client: Client, batch: any[]): Promise<void> {
  if (batch.length === 0) return;

  const cols = [
    'id', 'doi', 'title', 'publication_year', 'publication_date', 'type', 'language',
    'cited_by_count', 'referenced_works_count', 'domain', 'field', 'subfield',
    'primary_topic', 'topics', 'concepts', 'concepts_full', 'keywords', 'keywords_full',
    'references_full', 'related_full', 'license', 'pdf_url', 'abstract', 'is_oa', 'oa_url',
    'source_id', 'source_name', 'source_type', 'num_authors', 'authors', 'author_ids',
    'full_authors_info', 'apc_currency', 'apc_value', 'apc_usd',
  ];

  const values: any[] = [];
  const placeholders: string[] = [];

  batch.forEach((row, i) => {
    const offset = i * cols.length;
    placeholders.push(`(${cols.map((_, j) => `$${offset + j + 1}`).join(', ')})`);
    values.push(
      row.id,
      row.doi || null,
      row.title || '',
      toInt(row.publication_year),
      row.publication_date || null,
      row.type || null,
      row.language || null,
      toInt(row.cited_by_count) ?? 0,
      toInt(row.referenced_works_count) ?? 0,
      row.domain || null,
      row.field_name || null,        // field_name → field column
      row.subfield || null,
      row.primary_topic || null,
      row.topics || null,
      row.concepts || null,
      row.concepts_full ? JSON.stringify(row.concepts_full) : null,
      row.keywords || null,
      row.keywords_full ? JSON.stringify(row.keywords_full) : null,
      row.references_full ? JSON.stringify(row.references_full) : null,
      row.related_full ? JSON.stringify(row.related_full) : null,
      row.license || null,
      row.pdf_url || null,
      row.abstract || null,
      toBool(row.is_oa),
      row.oa_url || null,
      row.source_id || null,
      row.source_name || null,
      row.source_type || null,
      toInt(row.num_authors) ?? 0,
      row.authors || null,
      row.author_ids || null,
      row.full_authors_info ? JSON.stringify(row.full_authors_info) : null,
      row.apc_currency || null,
      toFloat(row.apc_value),
      toFloat(row.apc_usd),
    );
  });

  const sql = `
    INSERT INTO works (${cols.join(', ')})
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (id) DO NOTHING
  `;

  await client.query(sql, values);
}

async function insertAuthors(client: Client, batch: AuthorRow[]): Promise<void> {
  if (batch.length === 0) return;

  const cols = [
    'paper_id', 'author_id', 'display_name', 'orcid', 'first_institution_id',
    'first_institution_name', 'country_code', 'institutions_full', 'institutions_raw',
    'publication_year', 'publication_date',
  ];

  const values: any[] = [];
  const placeholders: string[] = [];

  batch.forEach((row, i) => {
    const offset = i * cols.length;
    placeholders.push(`(${cols.map((_, j) => `$${offset + j + 1}`).join(', ')})`);
    values.push(
      row.paperId,
      row.authorId,
      row.displayName,
      row.orcid,
      row.firstInstitutionId,
      row.firstInstitutionName,
      row.countryCode,
      row.institutionsFull ? JSON.stringify(row.institutionsFull) : null,
      row.institutionsRaw ? JSON.stringify(row.institutionsRaw) : null,
      row.publicationYear,
      row.publicationDate,
    );
  });

  const sql = `
    INSERT INTO authors (${cols.join(', ')})
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (paper_id, author_id) DO NOTHING
  `;

  await client.query(sql, values);
}

async function main() {
  console.log('Reading JSON file...');
  const raw = fs.readFileSync(JSON_PATH, 'utf-8');
  console.log('Parsing JSON...');
  const parsed = JSON.parse(raw);
  const data: any[] = parsed.data;
  console.log(`Total records: ${data.length}`);

  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('Connected to database');

  console.log('Truncating authors...');
  await client.query('TRUNCATE TABLE authors CASCADE');
  console.log('Truncating works...');
  await client.query('TRUNCATE TABLE works CASCADE');
  console.log('Tables cleared');

  let worksBatch: any[] = [];
  let authorsBatch: AuthorRow[] = [];
  let processed = 0;

  for (const row of data) {
    worksBatch.push(row);

    const pubYear = toInt(row.publication_year);
    const pubDate = row.publication_date || null;
    const authors = parseAuthorsInfo(row.full_authors_info, row.id, pubYear, pubDate);
    authorsBatch.push(...authors);

    if (worksBatch.length >= BATCH_SIZE) {
      await insertWorks(client, worksBatch);
      await insertAuthors(client, authorsBatch);
      processed += worksBatch.length;
      worksBatch = [];
      authorsBatch = [];
      process.stdout.write(`\rProcessed: ${processed}/${data.length}`);
    }
  }

  // flush remainder
  if (worksBatch.length > 0) {
    await insertWorks(client, worksBatch);
    await insertAuthors(client, authorsBatch);
    processed += worksBatch.length;
  }

  console.log(`\nDone. Imported ${processed} works.`);

  const { rows: wCount } = await client.query('SELECT COUNT(*) FROM works');
  const { rows: aCount } = await client.query('SELECT COUNT(*) FROM authors');
  console.log(`DB counts → works: ${wCount[0].count}, authors: ${aCount[0].count}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
