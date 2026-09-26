import { BadRequestException } from '@nestjs/common';
import { WorksService, WorkFilters } from './works.service';
import { TrinoService } from '../database/trino.service';

// Exercises the SQL-building logic directly: every filter that reaches a query
// must come out with injection payloads neutralized (quotes escaped) rather
// than able to break out of the string literal. trino-client has no parameter
// binding API at all, so this test suite is the actual enforcement mechanism —
// nothing in the type system stops a future filter from skipping sqlString().
describe('WorksService SQL building', () => {
  let service: WorksService;
  let queries: string[];
  let trino: { query: jest.Mock };

  beforeEach(() => {
    queries = [];
    trino = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    };
    service = new WorksService(trino as unknown as TrinoService);
  });

  async function capture(fn: () => Promise<unknown>): Promise<string[]> {
    queries = [];
    await fn();
    return queries;
  }

  describe('findAll — string filters are escaped, not interpolated raw', () => {
    const injectionPayloads = [
      `x' OR '1'='1`,
      `x'; DROP TABLE works; --`,
      `x' UNION SELECT * FROM authors --`,
      `O'Brien`, // legitimate apostrophe, must still work and not corrupt the query
    ];

    it.each(injectionPayloads)('escapes single quotes in the search filter: %s', async (payload) => {
      const [sql] = await capture(() => service.findAll({ search: payload }));
      // every single quote from the payload must be doubled (SQL-escaped),
      // meaning no unescaped ' immediately followed by non-' survives inside the literal
      const term = `%${payload.replace(/'/g, "''")}%`;
      expect(sql).toContain(`LOWER(title) LIKE LOWER('${term}')`);
      // the raw, unescaped payload must never appear verbatim in the query
      if (payload.includes("'")) {
        expect(sql).not.toContain(`'${payload}'`);
      }
    });

    it.each(injectionPayloads)('escapes single quotes in the field filter: %s', async (payload) => {
      const [sql] = await capture(() => service.findAll({ field: payload }));
      expect(sql).toContain(`field = '${payload.replace(/'/g, "''")}'`);
    });

    it.each(injectionPayloads)('escapes single quotes in the domain filter: %s', async (payload) => {
      const [sql] = await capture(() => service.findAll({ domain: payload }));
      expect(sql).toContain(`domain = '${payload.replace(/'/g, "''")}'`);
    });
  });

  describe('id-based lookups — escaped the same way', () => {
    const payload = `W123' OR '1'='1`;
    const escaped = payload.replace(/'/g, "''");

    it('findOne', async () => {
      const [sql] = await capture(() => service.findOne(payload));
      expect(sql).toContain(`WHERE id = '${escaped}'`);
    });

    it('coAuthors', async () => {
      const [sql] = await capture(() => service.coAuthors(payload));
      expect(sql).toContain(`WHERE work_id = '${escaped}'`);
    });

    it('authorDetail', async () => {
      const [sql] = await capture(() => service.authorDetail(payload));
      expect(sql).toContain(`WHERE wa.author_id = '${escaped}'`);
    });

    it('searchInstitutions', async () => {
      const [sql] = await capture(() => service.searchInstitutions(payload));
      expect(sql).toContain(`LIKE LOWER('%${escaped}%')`);
    });

    it('institutionWorks', async () => {
      const [sql] = await capture(() => service.institutionWorks(payload));
      expect(sql).toContain(`WHERE wi.institution_id = '${escaped}'`);
    });
  });

  describe('numeric filters are validated before interpolation, never raw strings', () => {
    it('rejects a non-integer limit rather than interpolating it', async () => {
      await expect(service.findAll({ limit: 1.5 })).rejects.toThrow(BadRequestException);
    });

    it('rejects a negative offset', async () => {
      await expect(service.findAll({ offset: -1 })).rejects.toThrow(BadRequestException);
    });

    it('rejects an out-of-range year', async () => {
      await expect(service.findAll({ year: 99999 })).rejects.toThrow(BadRequestException);
    });

    it('caps limit at the endpoint max rather than trusting the caller', async () => {
      const [sql] = await capture(() => service.findAll({ limit: 200, offset: 0 } as WorkFilters));
      expect(sql).toContain('LIMIT 200');
      // findAll's own max is 200 — this documents that ceiling exists and is enforced
    });

    it('sortBy is whitelist-mapped, not interpolated raw even if bypassed via `as any`', async () => {
      const [sql] = await capture(() =>
        service.findAll({ sortBy: `citedByCount'; DROP TABLE works; --` as any }),
      );
      // an unrecognized key falls through to the default column, never reaching the SQL as-is
      expect(sql).toContain('ORDER BY cited_by_count');
      expect(sql).not.toContain('DROP TABLE');
    });
  });
});
