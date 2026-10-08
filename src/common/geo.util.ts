export interface MapQuery {
  zoom: number;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Max institutions returned per zoom level — ensures something always shows.
 * Smooth exponential in zoom (zoom levels are themselves a log2 scale of map
 * resolution, so growing the count exponentially with zoom is what "log
 * scaled" LOD actually means here), not a hand-picked step function.
 */
export function maxCount(zoom: number): number {
  return Math.round(Math.min(3000, Math.max(10, 30 * Math.pow(1.72, zoom))));
}

export function inBbox(lat: number, lng: number, q: MapQuery): boolean {
  if (lat < q.minLat || lat > q.maxLat) return false;
  if (q.minLng <= q.maxLng) return lng >= q.minLng && lng <= q.maxLng;
  return lng >= q.minLng || lng <= q.maxLng; // antimeridian wrap
}

export function emptyFC() {
  return { type: 'FeatureCollection' as const, features: [] };
}
