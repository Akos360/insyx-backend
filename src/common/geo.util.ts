export interface MapQuery {
  zoom: number;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Max institutions returned per zoom level — ensures something always shows. */
export function maxCount(zoom: number): number {
  if (zoom >= 8) return 2000;
  if (zoom >= 6) return 500;
  if (zoom >= 4) return 200;
  if (zoom >= 2) return 100;
  return 30;
}

export function inBbox(lat: number, lng: number, q: MapQuery): boolean {
  if (lat < q.minLat || lat > q.maxLat) return false;
  if (q.minLng <= q.maxLng) return lng >= q.minLng && lng <= q.maxLng;
  return lng >= q.minLng || lng <= q.maxLng; // antimeridian wrap
}

export function emptyFC() {
  return { type: 'FeatureCollection' as const, features: [] };
}
