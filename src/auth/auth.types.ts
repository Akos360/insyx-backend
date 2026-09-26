export type AccessTokenPayload = { sub: string; email: string; type: 'access' };
export type RefreshTokenPayload = { sub: string; type: 'refresh' };
