import type { Request } from 'express';

/**
 * True only when there's actual proof this request reached us over https —
 * either Express's own `req.secure` (a real TLS socket) or an
 * `x-forwarded-proto: https` header set by a reverse proxy that terminated
 * TLS in front of us. Never inferred from NODE_ENV (this app's own Docker
 * image always sets NODE_ENV=production — see force-https.middleware.ts).
 * Used to decide the `secure` flag on auth cookies: true once behind a real
 * proxy, false for local/unproxied http so cookies still work in dev.
 */
export function isHttps(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}
