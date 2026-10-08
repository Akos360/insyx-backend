import { QueryFailedError, type Repository } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let repo: { findOneBy: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findOneBy: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => ({ id: 'generated-id', createdAt: new Date(), updatedAt: new Date(), ...entity })),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new UsersService(repo as unknown as Repository<User>);
  });

  it('findByEmail lower-cases the lookup email', async () => {
    await service.findByEmail('Person@Example.COM');
    expect(repo.findOneBy).toHaveBeenCalledWith({ email: 'person@example.com' });
  });

  it('create lower-cases the stored email', async () => {
    const user = await service.create('Person@Example.COM', 'hash');
    expect(repo.create).toHaveBeenCalledWith({ email: 'person@example.com', passwordHash: 'hash' });
    expect(user.email).toBe('person@example.com');
  });

  it('findById looks up by raw id', async () => {
    await service.findById('user-1');
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'user-1' });
  });

  describe('updateProfile', () => {
    it('lower-cases the email when updating both name and email', async () => {
      await service.updateProfile('user-1', { name: 'Jane Doe', email: 'Jane@Example.COM' });
      expect(repo.update).toHaveBeenCalledWith({ id: 'user-1' }, { name: 'Jane Doe', email: 'jane@example.com' });
    });

    it('only patches the fields that were provided', async () => {
      await service.updateProfile('user-1', { name: 'Jane Doe' });
      expect(repo.update).toHaveBeenCalledWith({ id: 'user-1' }, { name: 'Jane Doe' });
    });

    it('does nothing when no fields are provided', async () => {
      await service.updateProfile('user-1', {});
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  it('preserves the Google account creation contract and verified status', async () => {
    await service.createFromGoogle(' Person@Example.COM ', 'google-sub');
    expect(repo.create).toHaveBeenCalledWith({ email: 'person@example.com', passwordHash: null, googleId: 'google-sub', emailVerified: true });
  });

  it('never returns credentials or provider identifiers through profile APIs', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'user-1', email: 'person@example.com', passwordHash: 'secret', googleId: 'sub', resetTokenHash: 'token', resetTokenExpiresAt: new Date() });
    const profile = await service.getProfile('user-1');
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('googleId');
    expect(profile).not.toHaveProperty('resetTokenHash');
    expect(profile).not.toHaveProperty('resetTokenExpiresAt');
  });

  it('resets verification only when the normalized email actually changes', async () => {
    repo.findOneBy.mockResolvedValue({ email: 'old@example.com' });
    await service.updateProfile('user-1', { email: ' NEW@example.com ' });
    expect(repo.update).toHaveBeenCalledWith({ id: 'user-1' }, { email: 'new@example.com', emailVerified: false });
    repo.update.mockClear();
    await service.updateProfile('user-1', { email: ' OLD@example.com ' });
    expect(repo.update).toHaveBeenCalledWith({ id: 'user-1' }, { email: 'old@example.com' });
  });

  it('rejects empty self updates even when DTO properties exist with undefined values', async () => {
    await expect(service.updateSelf('user-1', { email: undefined, name: undefined, avatarUrl: undefined })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears avatars and ignores privileged fields in service profile updates', async () => {
    await service.updateProfile('user-1', { avatarUrl: null, googleId: 'spoofed' } as never);
    expect(repo.update).toHaveBeenCalledWith({ id: 'user-1' }, { avatarUrl: null });
  });

  it('returns 404 for missing profiles and deletion targets', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.getProfile('missing')).rejects.toBeInstanceOf(NotFoundException);
    repo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes by the session user id', async () => {
    repo.delete.mockResolvedValue({ affected: 1 });
    await service.remove('user-1');
    expect(repo.delete).toHaveBeenCalledWith({ id: 'user-1' });
  });

  it('maps uniqueness violations on inserts and updates to HTTP conflicts', async () => {
    const error = new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate'), { code: '23505' }));
    repo.save.mockRejectedValue(error);
    await expect(service.create('person@example.com', 'hash')).rejects.toBeInstanceOf(ConflictException);
    repo.update.mockRejectedValue(error);
    await expect(service.updateProfile('user-1', { name: 'Alex' })).rejects.toBeInstanceOf(ConflictException);
  });

});
