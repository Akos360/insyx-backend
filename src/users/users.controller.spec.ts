import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('Users HTTP API', () => {
  let app: INestApplication<App>;
  const id = 'd624711e-70b5-4c15-985e-6ba9bad0a2ac';
  const service = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => { await app.close(); });

  it('normalizes profile input and creates a user', async () => {
    service.create.mockResolvedValue({ id, email: 'alex@example.com' });
    await request(app.getHttpServer()).post('/users').send({ email: ' ALEX@example.com ', displayName: ' Alex ' }).expect(201);
    expect(service.create).toHaveBeenCalledWith({ email: 'alex@example.com', displayName: 'Alex' });
  });

  it.each([
    {}, { email: 'invalid', displayName: 'Alex' },
    { email: 'alex@example.com', displayName: ' ' },
    { email: 'alex@example.com', displayName: 'Alex', googleSubject: 'spoofed' },
    { email: 'alex@example.com', displayName: 'Alex', emailVerified: true },
    { email: 'alex@example.com', displayName: 'Alex', avatarUrl: 'javascript:alert(1)' },
    { email: null, displayName: 'Alex' },
  ])('rejects invalid or privileged create input: %j', async (input) => {
    await request(app.getHttpServer()).post('/users').send(input).expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('lists with defaults', async () => {
    service.findAll.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    await request(app.getHttpServer()).get('/users').expect(200);
    expect(service.findAll).toHaveBeenCalledWith(20, 0);
  });

  it.each(['limit=0', 'limit=101', 'offset=-1', 'limit=1.5', 'offset=abc', 'offset=9007199254740992'])('rejects invalid pagination: %s', async (query) => {
    await request(app.getHttpServer()).get(`/users?${query}`).expect(400);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('rejects invalid UUIDs', async () => {
    await request(app.getHttpServer()).get('/users/not-a-uuid').expect(400);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it.each([{}, { email: null }, { displayName: null }, { googleSubject: 'spoofed' }])('rejects invalid profile patches: %j', async (input) => {
    await request(app.getHttpServer()).patch(`/users/${id}`).send(input).expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('allows clearing an avatar', async () => {
    service.update.mockResolvedValue({ id, avatarUrl: null });
    await request(app.getHttpServer()).patch(`/users/${id}`).send({ avatarUrl: null }).expect(200);
    expect(service.update).toHaveBeenCalledWith(id, { avatarUrl: null });
  });

  it('returns no content after deletion', async () => {
    service.remove.mockResolvedValue(undefined);
    await request(app.getHttpServer()).delete(`/users/${id}`).expect(204).expect('');
  });
});
