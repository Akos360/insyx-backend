import { BadRequestException } from '@nestjs/common';
import { WorksService, WorkFilters } from './works.service';
import { TrinoService } from '../database/trino.service';

// trino-client has no parameter binding API, so escaping is the actual injection defense —
// this suite is what enforces it, since nothing in the type system stops a filter skipping sqlString().
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
      const term = `%${payload.replace(/'/g, "''")}%`;
      expect(sql).toContain(`LOWER(title) LIKE LOWER('${term}')`);
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
      expect(sql).toContain(`WHERE w.id = '${escaped}'`);
    });

    it('coAuthors', async () => {
      const [sql] = await capture(() => service.coAuthors(payload));
      expect(sql).toContain(`WHERE work_id = '${escaped}'`);
    });

    it('workTopics', async () => {
      const [sql] = await capture(() => service.workTopics(payload));
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
    });

    it('sortBy is whitelist-mapped, not interpolated raw even if bypassed via `as any`', async () => {
      const [sql] = await capture(() =>
        service.findAll({ sortBy: `citedByCount'; DROP TABLE works; --` as any }),
      );
      // unrecognized sortBy falls through to the default column, never reaching the SQL as-is
      expect(sql).toContain('ORDER BY cited_by_count');
      expect(sql).not.toContain('DROP TABLE');
    });
  });

  describe('exportCsv', () => {
    it('escapes the search filter the same way as findAll', async () => {
      const payload = `x' OR '1'='1`;
      const [sql] = await capture(() => service.exportCsv({ search: payload }));
      expect(sql).toContain(`LOWER(title) LIKE LOWER('%${payload.replace(/'/g, "''")}%')`);
    });

    it('caps the row count', async () => {
      const [sql] = await capture(() => service.exportCsv());
      expect(sql).toContain('LIMIT 20000');
    });

    it('quotes and escapes CSV cells containing commas, quotes, or newlines', async () => {
      trino.query.mockResolvedValueOnce([
        {
          title: 'A "notable" study, part 2',
          authors: "O'Brien; Jane Doe",
          publication_year: 2020,
          domain: 'Medicine',
          field: 'Genomics',
          cited_by_count: 12,
          is_oa: true,
          source_name: 'Journal\nof Things',
        },
      ]);

      const csv = await service.exportCsv();
      const lines = csv.split('\r\n');
      expect(lines[0]).toBe('Title,Authors,Year,Domain,Field,Citations,Open Access,Source');
      expect(lines[1]).toBe(
        '"A ""notable"" study, part 2",O\'Brien; Jane Doe,2020,Medicine,Genomics,12,Yes,"Journal\nof Things"',
      );
    });
  });
});

describe('WorksService institution locations', () => {
  let service: WorksService;
  let trino: { query: jest.Mock };
  const world = { zoom: 0, minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
  const institution = (id: string, latitude: number | null, longitude: number | null) => ({
    id, name: id, country_code: 'SK', works_count: 5, cited_by_count: 10, latitude, longitude,
  });

  beforeEach(() => {
    trino = { query: jest.fn() };
    service = new WorksService(trino as unknown as TrinoService);
  });

  it('uses exact stored coordinates in longitude/latitude order, including zero', async () => {
    trino.query.mockResolvedValue([institution('I1', 48.15, 17.1), institution('I2', 0, 0)]);
    const result = await service.institutionsMap(world);
    expect(result.features.map((f) => f.geometry.coordinates)).toEqual([[17.1, 48.15], [0, 0]]);
  });

  it('excludes missing, nonfinite and out-of-range coordinates', async () => {
    trino.query.mockResolvedValue([
      institution('I1', null, 17), institution('I2', 48, null),
      institution('I3', 91, 17), institution('I4', 48, -181),
      institution('I5', NaN, 17), institution('I6', 48, Infinity),
    ]);
    expect(await service.institutionsMap(world)).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('filters by the actual location and supports antimeridian bounds', async () => {
    trino.query.mockResolvedValue([
      institution('east', 0, 179), institution('west', 0, -179), institution('outside', 0, 17),
    ]);
    const result = await service.institutionsMap({ ...world, minLng: 170, maxLng: -170 });
    expect(result.features.map((f) => f.id)).toEqual(['east', 'west']);
  });

  it('returns affiliations in work detail without multiplying the work row', async () => {
    const institutions = [institution('I1', 48, 17), institution('I2', 49, 18)];
    trino.query.mockResolvedValueOnce([{ id: 'W1', title: 'Shared work' }]).mockResolvedValueOnce(institutions);
    expect(await service.findOne('W1')).toEqual({ id: 'W1', title: 'Shared work', institutions });
    expect(trino.query.mock.calls[1][0]).toContain('SELECT DISTINCT');
  });

  it('does not fetch affiliations when the work does not exist', async () => {
    trino.query.mockResolvedValueOnce([]);
    expect(await service.findOne('missing')).toBeNull();
    expect(trino.query).toHaveBeenCalledTimes(1);
  });

  it('escapes the work ID when fetching institutions', async () => {
    trino.query.mockResolvedValue([]);
    await service.workInstitutions("W1' OR '1'='1");
    expect(trino.query.mock.calls[0][0]).toContain("WHERE wi.work_id = 'W1'' OR ''1''=''1'");
  });
});
