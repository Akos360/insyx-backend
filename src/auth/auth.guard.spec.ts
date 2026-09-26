import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

function mockContext(cookies: Record<string, string>) {
  const req: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('AuthGuard', () => {
  let jwt: { verifyAsync: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    guard = new AuthGuard(jwt as unknown as JwtService);
  });

  it('allows the request and attaches req.user for a valid access cookie', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'a@b.com', type: 'access' });
    const context = mockContext({ access_token: 'a-valid-jwt' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual({
      sub: 'user-1',
      email: 'a@b.com',
      type: 'access',
    });
  });

  it('rejects when there is no access_token cookie at all', async () => {
    const context = mockContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid/expired token', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = mockContext({ access_token: 'garbage' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a refresh token presented as an access token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh' });
    const context = mockContext({ access_token: 'a-refresh-jwt' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
