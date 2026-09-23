import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// ISO 3166-1 alpha-2 → [lat, lng] country centroids
const CENTROIDS: Record<string, [number, number]> = {
  AD: [42.55, 1.60],   AE: [23.42, 53.85],  AF: [33.94, 67.71],
  AG: [17.06, -61.80], AL: [41.15, 20.17],  AM: [40.07, 45.04],
  AO: [-11.20, 17.87], AR: [-38.42, -63.62], AT: [47.52, 14.55],
  AU: [-25.27, 133.78], AZ: [40.14, 47.58],  BA: [43.92, 17.68],
  BB: [13.19, -59.54], BD: [23.68, 90.36],  BE: [50.50, 4.47],
  BF: [12.36, -1.56],  BG: [42.73, 25.49],  BH: [25.93, 50.64],
  BI: [-3.38, 29.92],  BJ: [9.31, 2.32],    BN: [4.53, 114.73],
  BO: [-16.29, -63.59], BR: [-14.24, -51.93], BS: [25.03, -77.40],
  BT: [27.51, 90.43],  BW: [-22.33, 24.68], BY: [53.71, 27.95],
  BZ: [17.19, -88.50], CA: [56.13, -106.35], CD: [-4.04, 21.76],
  CF: [6.61, 20.94],   CG: [-0.23, 15.83],  CH: [46.82, 8.23],
  CI: [7.54, -5.55],   CL: [-35.68, -71.54], CM: [3.85, 11.50],
  CN: [35.86, 104.20], CO: [4.57, -74.30],  CR: [9.75, -83.75],
  CU: [21.52, -79.26], CV: [16.54, -23.04], CY: [35.13, 33.43],
  CZ: [49.82, 15.47],  DE: [51.17, 10.45],  DJ: [11.83, 42.59],
  DK: [56.26, 9.50],   DM: [15.41, -61.37], DO: [18.74, -70.16],
  DZ: [28.03, 1.66],   EC: [-1.83, -78.18], EE: [58.60, 25.01],
  EG: [26.82, 30.80],  ER: [15.18, 39.78],  ES: [40.46, -3.75],
  ET: [9.15, 40.49],   FI: [61.92, 25.75],  FJ: [-17.71, 178.07],
  FR: [46.23, 2.21],   GA: [-0.80, 11.61],  GB: [55.38, -3.44],
  GD: [12.12, -61.68], GE: [42.32, 43.36],  GH: [7.95, -1.02],
  GM: [13.44, -15.31], GN: [9.95, -11.61],  GQ: [1.65, 10.27],
  GR: [39.07, 21.82],  GT: [15.78, -90.23], GW: [11.80, -15.18],
  GY: [4.86, -58.93],  HN: [15.20, -86.24], HR: [45.10, 15.20],
  HT: [18.97, -72.29], HU: [47.16, 19.50],  ID: [-0.79, 113.92],
  IE: [53.41, -8.24],  IL: [31.05, 34.85],  IN: [20.59, 78.96],
  IQ: [33.22, 43.68],  IR: [32.43, 53.69],  IS: [64.96, -19.02],
  IT: [41.87, 12.57],  JM: [18.11, -77.30], JO: [30.59, 36.24],
  JP: [36.20, 138.25], KE: [-0.02, 37.91],  KG: [41.20, 74.77],
  KH: [12.57, 104.99], KI: [-3.37, -168.73], KM: [-11.64, 43.33],
  KN: [17.36, -62.78], KP: [40.34, 127.51], KR: [35.91, 127.77],
  KW: [29.31, 47.48],  KZ: [48.02, 66.92],  LA: [19.86, 102.50],
  LB: [33.85, 35.86],  LC: [13.91, -60.98], LI: [47.17, 9.56],
  LK: [7.87, 80.77],   LR: [6.43, -9.43],   LS: [-29.61, 28.23],
  LT: [55.17, 23.88],  LU: [49.82, 6.13],   LV: [56.88, 24.60],
  LY: [26.34, 17.23],  MA: [31.79, -7.09],  MC: [43.75, 7.40],
  MD: [47.41, 28.37],  ME: [42.71, 19.37],  MG: [-18.77, 46.87],
  MK: [41.61, 21.75],  ML: [17.57, -3.99],  MM: [21.92, 95.96],
  MN: [46.86, 103.85], MR: [21.00, -10.94], MT: [35.94, 14.38],
  MU: [-20.35, 57.55], MV: [3.20, 73.22],   MW: [-13.25, 34.30],
  MX: [23.63, -102.55], MY: [4.21, 101.98], MZ: [-18.67, 35.53],
  NA: [-22.96, 18.49], NE: [17.61, 8.08],   NG: [9.08, 8.68],
  NI: [12.87, -85.21], NL: [52.13, 5.29],   NO: [60.47, 8.47],
  NP: [28.39, 84.12],  NR: [-0.52, 166.93], NZ: [-40.90, 174.89],
  OM: [21.51, 55.92],  PA: [8.54, -80.78],  PE: [-9.19, -75.02],
  PG: [-6.31, 143.95], PH: [12.88, 121.77], PK: [30.38, 69.35],
  PL: [51.92, 19.14],  PT: [39.40, -8.22],  PW: [7.52, 134.58],
  PY: [-23.44, -58.44], QA: [25.35, 51.18], RO: [45.94, 24.97],
  RS: [44.02, 21.01],  RU: [61.52, 105.32], RW: [-1.94, 29.87],
  SA: [23.89, 45.08],  SB: [-9.64, 160.16], SC: [-4.68, 55.49],
  SD: [12.86, 30.22],  SE: [60.13, 18.64],  SG: [1.35, 103.82],
  SI: [46.15, 14.99],  SK: [48.67, 19.70],  SL: [8.46, -11.78],
  SM: [43.94, 12.46],  SN: [14.50, -14.45], SO: [5.15, 46.20],
  SR: [3.92, -56.03],  SS: [7.86, 29.69],   ST: [0.19, 6.61],
  SV: [13.79, -88.90], SY: [34.80, 38.99],  SZ: [-26.52, 31.47],
  TD: [15.45, 18.73],  TG: [8.62, 0.82],    TH: [15.87, 100.99],
  TJ: [38.86, 71.28],  TL: [-8.87, 125.73], TM: [38.97, 59.56],
  TN: [33.89, 9.54],   TO: [-21.18, -175.20], TR: [38.96, 35.24],
  TT: [10.69, -61.22], TV: [-7.11, 177.64], TW: [23.70, 120.96],
  TZ: [-6.37, 34.89],  UA: [48.38, 31.17],  UG: [1.37, 32.29],
  US: [37.09, -95.71], UY: [-32.52, -55.77], UZ: [41.38, 63.95],
  VA: [41.90, 12.45],  VC: [12.98, -61.29], VE: [6.42, -66.59],
  VN: [14.06, 108.28], VU: [-15.38, 166.96], WS: [-13.76, -172.10],
  XK: [42.60, 20.90],  YE: [15.55, 48.52],  ZA: [-30.56, 22.94],
  ZM: [-13.13, 27.85], ZW: [-19.02, 29.15],
  HK: [22.40, 114.11], MO: [22.17, 113.55],
};

export interface MapQuery {
  zoom: number;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

interface AggRow {
  id: string;
  name: string;
  country_code: string;
  work_count: string;
  citation_count: string;
}

@Injectable()
export class InstitutionsService {
  private readonly logger = new Logger(InstitutionsService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getMapFeatures(query: MapQuery) {
    const rows: AggRow[] = await this.ds.query(`
      SELECT
        COALESCE(a.first_institution_id, a.first_institution_name) AS id,
        MAX(a.first_institution_name)                              AS name,
        MAX(a.country_code)                                        AS country_code,
        COUNT(DISTINCT a.paper_id)::int                            AS work_count,
        COALESCE(SUM(p.cited_by_count), 0)::int                   AS citation_count
      FROM authors a
      JOIN works p ON a.paper_id = p.id
      WHERE a.first_institution_name IS NOT NULL
      GROUP BY COALESCE(a.first_institution_id, a.first_institution_name)
    `);

    this.logger.log(`SQL returned ${rows.length} rows for zoom=${query.zoom.toFixed(1)} bbox=[${query.minLng.toFixed(1)},${query.minLat.toFixed(1)},${query.maxLng.toFixed(1)},${query.maxLat.toFixed(1)}]`);

    if (!rows.length) return emptyFC();

    // Log-scale score: weights citations slightly more than work count
    const scored = rows
      .map((r) => {
        const wc = Number(r.work_count);
        const cc = Number(r.citation_count);
        return { ...r, rawScore: Math.log1p(wc) * 0.4 + Math.log1p(cc) * 0.6 };
      })
      .sort((a, b) => b.rawScore - a.rawScore);

    // Use reduce so large datasets don't blow the call stack
    const maxRaw = scored.reduce((m, r) => Math.max(m, r.rawScore), 0) || 1;
    this.logger.log(`maxRaw=${maxRaw.toFixed(3)}, top institution: ${scored[0]?.name} (rawScore=${scored[0]?.rawScore.toFixed(3)})`);

    // bbox filter first, then cap at zoom-appropriate top-N so we always show something
    const limit = maxCount(query.zoom);
    const features = scored
      .map((r) => {
        const score = r.rawScore / maxRaw;
        const centroid = CENTROIDS[r.country_code] ?? [0, 0];
        const [jLat, jLng] = jitter(r.id);
        return {
          r,
          score,
          lat: centroid[0] + jLat,
          lng: centroid[1] + jLng,
        };
      })
      .filter(({ lat, lng }) => inBbox(lat, lng, query))
      .slice(0, limit);

    this.logger.log(`Returning ${features.length}/${scored.length} features (limit=${limit})`);

    return {
      type: 'FeatureCollection' as const,
      features: features.map(({ r, score, lat, lng }) => ({
        type: 'Feature' as const,
        id: r.id,
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        properties: {
          name: r.name,
          workCount: Number(r.work_count),
          citationCount: Number(r.citation_count),
          score,
          countryCode: r.country_code ?? '',
        },
      })),
    };
  }

  async searchInstitutions(q: string) {
    const rows: AggRow[] = await this.ds.query(
      `SELECT
         COALESCE(a.first_institution_id, a.first_institution_name) AS id,
         MAX(a.first_institution_name)                              AS name,
         MAX(a.country_code)                                        AS country_code,
         COUNT(DISTINCT a.paper_id)::int                            AS work_count,
         COALESCE(SUM(p.cited_by_count), 0)::int                   AS citation_count
       FROM authors a
       JOIN works p ON a.paper_id = p.id
       WHERE a.first_institution_name ILIKE $1
       GROUP BY COALESCE(a.first_institution_id, a.first_institution_name)
       ORDER BY work_count DESC
       LIMIT 20`,
      [`%${q}%`],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      countryCode: r.country_code ?? '',
      workCount: Number(r.work_count),
      citationCount: Number(r.citation_count),
    }));
  }

  async getInstitutionWorks(institutionId: string) {
    return this.ds.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (p.id)
           p.id, p.title, p.doi, p.type, p.language, p.abstract,
           p.cited_by_count          AS "citedByCount",
           p.publication_year        AS "publicationYear",
           p.publication_date        AS "publicationDate",
           p.domain, p.field, p.subfield,
           p.primary_topic           AS "primaryTopic",
           p.keywords, p.concepts,
           p.is_oa                   AS "isOa",
           p.oa_url                  AS "oaUrl",
           p.pdf_url                 AS "pdfUrl",
           p.source_name             AS "sourceName",
           p.num_authors             AS "numAuthors",
           p.authors
         FROM works p
         JOIN authors a ON p.id = a.paper_id
         WHERE COALESCE(a.first_institution_id, a.first_institution_name) = $1
         ORDER BY p.id
       ) t
       ORDER BY t."citedByCount" DESC`,
      [institutionId],
    );
  }
}

// Max institutions returned per zoom level — ensures something always shows
function maxCount(zoom: number): number {
  if (zoom >= 8) return 2000;
  if (zoom >= 6) return 500;
  if (zoom >= 4) return 200;
  if (zoom >= 2) return 100;
  return 30;
}

// FNV-1a hash → deterministic per-institution offset so same-country institutions don't stack
function jitter(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const latJ = (((h & 0xff) / 255) - 0.5) * 3.0;          // ±1.5°
  const lngJ = ((((h >> 8) & 0xff) / 255) - 0.5) * 5.0;   // ±2.5°
  return [latJ, lngJ];
}

function inBbox(lat: number, lng: number, q: MapQuery): boolean {
  if (lat < q.minLat || lat > q.maxLat) return false;
  if (q.minLng <= q.maxLng) return lng >= q.minLng && lng <= q.maxLng;
  return lng >= q.minLng || lng <= q.maxLng; // antimeridian wrap
}

function emptyFC() {
  return { type: 'FeatureCollection' as const, features: [] };
}
