import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const id = 'd624711e-70b5-4c15-985e-6ba9bad0a2ac';
  const repository = {
    create: jest.fn(), save: jest.fn(), findOneBy: jest.fn(),
    findAndCount: jest.fn(), delete: jest.fn(), createQueryBuilder: jest.fn(),
  };
  let service: UsersService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new UsersService(repository as unknown as Repository<User>);
  });

  it('creates a normalized, unverified profile and returns only selected columns', async () => {
    const saved = { id, email: 'alex@example.com' };
    repository.create.mockImplementation((input: Partial<User>) => ({ id, ...input }));
    repository.save.mockResolvedValue(saved);
    repository.findOneBy.mockResolvedValue(saved);
    await expect(service.create({ email: ' ALEX@example.com ', displayName: ' Alex ' })).resolves.toEqual(saved);
    expect(repository.create).toHaveBeenCalledWith({ email: 'alex@example.com', displayName: 'Alex', avatarUrl: null, emailVerified: false, lastLoginAt: null });
  });

  it('maps concurrent duplicate-email violations to a conflict', async () => {
    repository.create.mockReturnValue({ id });
    const error = Object.assign(new Error('duplicate'), { code: '23505' });
    repository.save.mockRejectedValue(new QueryFailedError('INSERT', [], error));
    await expect(service.create({ email: 'alex@example.com', displayName: 'Alex' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('propagates unexpected database failures', async () => {
    repository.create.mockReturnValue({ id });
    repository.save.mockRejectedValue(new Error('database unavailable'));
    await expect(service.create({ email: 'alex@example.com', displayName: 'Alex' })).rejects.toThrow('database unavailable');
  });

  it('returns 404 for missing profiles', async () => {
    repository.findOneBy.mockResolvedValue(null);
    await expect(service.findOne(id)).rejects.toBeInstanceOf(NotFoundException);
    repository.delete.mockResolvedValue({ affected: 0 });
    await expect(service.remove(id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('paginates with stable ordering', async () => {
    repository.findAndCount.mockResolvedValue([[], 42]);
    await expect(service.findAll(10, 20)).resolves.toEqual({ items: [], total: 42, limit: 10, offset: 20 });
    expect(repository.findAndCount).toHaveBeenCalledWith({ take: 10, skip: 20, order: { createdAt: 'DESC', id: 'ASC' } });
  });

  it('resets email verification when a local profile changes email', async () => {
    const user = { id, email: 'old@example.com', emailVerified: true };
    repository.findOneBy.mockResolvedValue(user);
    const builder = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ googleSubject: null }) };
    repository.createQueryBuilder.mockReturnValue(builder);
    await service.update(id, { email: ' NEW@example.com ' });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com', emailVerified: false }));
  });

  it('prevents profile updates from changing a Google-linked email', async () => {
    repository.findOneBy.mockResolvedValue({ id, email: 'old@example.com' });
    const builder = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ googleSubject: 'google-account-subject' }) };
    repository.createQueryBuilder.mockReturnValue(builder);
    await expect(service.update(id, { email: 'new@example.com' })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('clears the avatar without overwriting other profile fields', async () => {
    const user = { id, email: 'alex@example.com', displayName: 'Alex', avatarUrl: 'https://example.com/avatar' };
    repository.findOneBy.mockResolvedValue(user);
    await service.update(id, { avatarUrl: null });
    expect(repository.save).toHaveBeenCalledWith({ ...user, avatarUrl: null });
  });

  it('deletes an existing profile', async () => {
    repository.delete.mockResolvedValue({ affected: 1 });
    await expect(service.remove(id)).resolves.toBeUndefined();
  });
});
