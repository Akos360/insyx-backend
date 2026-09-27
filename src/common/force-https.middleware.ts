import type { Request, Response, NextFunction } from 'express';

/**
 * Redirects http → https only when x-forwarded-proto: http proves a reverse proxy
 * terminated TLS upstream — not gated on NODE_ENV, since Docker sets that to
 * production locally too (no proxy present), which would break local dev.
 * No header at all (unproxied access) means this does nothing.
 */
export function forceHttps(req: Request, res: Response, next: NextFunction): void {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto === 'http') {
    res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    return;
  }
  next();
}
