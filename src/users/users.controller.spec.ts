import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthGuard } from '../auth/auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('Users HTTP API', () => {
  let app: INestApplication<App>;
  const id = 'd624711e-70b5-4c15-985e-6ba9bad0a2ac';
  let authenticated = true;
  const service = { getProfile: jest.fn(), updateSelf: jest.fn(), remove: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).overrideGuard(AuthGuard).useValue({
      canActivate(context: ExecutionContext) {
        if (!authenticated) throw new UnauthorizedException();
        context.switchToHttp().getRequest<{ user: { sub: string } }>().user = { sub: id };
        return true;
      },
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });
  beforeEach(() => { jest.resetAllMocks(); authenticated = true; });
  afterAll(async () => { await app.close(); });

  it('reads only the current session profile', async () => {
    service.getProfile.mockResolvedValue({ id, email: 'alex@example.com' });
    await request(app.getHttpServer()).get('/users/me').expect(200);
    expect(service.getProfile).toHaveBeenCalledWith(id);
  });

  it('normalizes the profile and scopes the update to the session user', async () => {
    service.updateSelf.mockResolvedValue({ id });
    await request(app.getHttpServer()).patch('/users/me')
      .send({ email: ' ALEX@example.com ', name: ' Alex ' }).expect(200);
    expect(service.updateSelf).toHaveBeenCalledWith(id, expect.objectContaining({ email: 'alex@example.com', name: 'Alex' }));
  });

  it.each([{ email: null }, { name: null }, { email: 'invalid' }, { name: ' ' }, { avatarUrl: 'javascript:alert(1)' }])('rejects invalid profile fields: %j', async (input) => {
    await request(app.getHttpServer()).patch('/users/me').send(input).expect(400);
    expect(service.updateSelf).not.toHaveBeenCalled();
  });

  it('strips identity and credential fields using the application whitelist', async () => {
    service.updateSelf.mockResolvedValue({ id });
    await request(app.getHttpServer()).patch('/users/me').send({
      name: 'Alex', id: 'someone-else', passwordHash: 'forged', googleId: 'spoofed', emailVerified: true,
    }).expect(200);
    const input = service.updateSelf.mock.calls[0][1] as Record<string, unknown>;
    expect(input).not.toHaveProperty('id');
    expect(input).not.toHaveProperty('passwordHash');
    expect(input).not.toHaveProperty('googleId');
    expect(input).not.toHaveProperty('emailVerified');
  });

  it('allows clearing an avatar', async () => {
    service.updateSelf.mockResolvedValue({ id, avatarUrl: null });
    await request(app.getHttpServer()).patch('/users/me').send({ avatarUrl: null }).expect(200);
    expect(service.updateSelf).toHaveBeenCalledWith(id, expect.objectContaining({ avatarUrl: null }));
  });

  it.each(['get', 'patch', 'delete'] as const)('requires authentication for %s', async (method) => {
    authenticated = false;
    await request(app.getHttpServer())[method]('/users/me').send({ name: 'Alex' }).expect(401);
    expect(service.getProfile).not.toHaveBeenCalled();
    expect(service.updateSelf).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('does not expose arbitrary users or public account creation/listing', async () => {
    await request(app.getHttpServer()).get(`/users/${id}`).expect(404);
    await request(app.getHttpServer()).get('/users').expect(404);
    await request(app.getHttpServer()).post('/users').send({ email: 'alex@example.com' }).expect(404);
  });

  it('deletes only the current account and clears both session cookies', async () => {
    service.remove.mockResolvedValue(undefined);
    const response = await request(app.getHttpServer()).delete('/users/me').expect(204).expect('');
    expect(service.remove).toHaveBeenCalledWith(id);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringContaining('access_token=;'), expect.stringContaining('refresh_token=;'),
    ]));
  });
});
