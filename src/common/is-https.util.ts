import type { Request } from 'express';

/**
 * True only with proof of https (req.secure or x-forwarded-proto) — never NODE_ENV,
 * which Docker always sets to production. Drives the `secure` flag on auth cookies.
 */
export function isHttps(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}
