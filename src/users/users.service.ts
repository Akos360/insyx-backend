import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.toLowerCase() });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  create(email: string, passwordHash: string): Promise<User> {
    const user = this.users.create({ email: email.toLowerCase(), passwordHash });
    return this.users.save(user);
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.users.findOneBy({ googleId });
  }

  createFromGoogle(email: string, googleId: string): Promise<User> {
    const user = this.users.create({ email: email.toLowerCase(), passwordHash: null, googleId });
    return this.users.save(user);
  }

  async linkGoogleId(userId: string, googleId: string): Promise<void> {
    await this.users.update({ id: userId }, { googleId });
  }

  async setResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.users.update({ id: userId }, { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt });
  }

  findByResetTokenHash(tokenHash: string): Promise<User | null> {
    return this.users.findOneBy({ resetTokenHash: tokenHash });
  }

  async clearResetToken(userId: string): Promise<void> {
    await this.users.update({ id: userId }, { resetTokenHash: null, resetTokenExpiresAt: null });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.users.update({ id: userId }, { passwordHash });
  }

  async updateProfile(userId: string, updates: { name?: string; email?: string; affiliation?: string }): Promise<void> {
    const patch: Partial<Pick<User, 'name' | 'email' | 'affiliation'>> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.affiliation !== undefined) patch.affiliation = updates.affiliation;
    if (updates.email !== undefined) patch.email = updates.email.toLowerCase();
    if (Object.keys(patch).length === 0) return;

    await this.users.update({ id: userId }, patch);
  }
}
