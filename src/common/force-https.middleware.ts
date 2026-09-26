import type { Request, Response, NextFunction } from 'express';

/**
 * Redirects http → https, but ONLY when there's actual proof a reverse proxy
 * terminated TLS and forwarded the request as plain http — i.e. the
 * `x-forwarded-proto: http` header is present. This is deliberately NOT gated
 * on `NODE_ENV === 'production'`: this app's own Dockerfile sets that env var
 * in the image we run and test against locally (no reverse proxy in front at
 * all), so a NODE_ENV-only check would redirect every local/dev request to an
 * https endpoint that doesn't exist there, breaking local verification.
 *
 * With no `x-forwarded-proto` header at all (direct, unproxied access — every
 * local/dev setup so far), this middleware does nothing. Once this sits behind
 * a real reverse proxy (nginx/Caddy) that sets the header, it starts
 * enforcing https automatically, no config change needed here.
 */
export function forceHttps(req: Request, res: Response, next: NextFunction): void {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto === 'http') {
    res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    return;
  }
  next();
}
