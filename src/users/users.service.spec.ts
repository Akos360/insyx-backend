import type { Repository } from 'typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let repo: { findOneBy: jest.Mock; create: jest.Mock; save: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findOneBy: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => ({ id: 'generated-id', createdAt: new Date(), updatedAt: new Date(), ...entity })),
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
});
