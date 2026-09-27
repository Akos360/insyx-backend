export type AccessTokenPayload = { sub: string; email: string; type: 'access' };
export type RefreshTokenPayload = { sub: string; type: 'refresh' };

// Response shape for all auth endpoints — never includes passwordHash or other sensitive fields.
export type AuthUserResponse = { id: string; email: string; name: string | null; affiliation: string | null };
