import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.trim().toLowerCase() });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  create(email: string, passwordHash: string): Promise<User> {
    const user = this.users.create({ email: email.trim().toLowerCase(), passwordHash });
    return this.save(user);
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.users.findOneBy({ googleId });
  }

  createFromGoogle(email: string, googleId: string): Promise<User> {
    const user = this.users.create({
      email: email.trim().toLowerCase(),
      passwordHash: null,
      googleId,
      emailVerified: true,
    });
    return this.save(user);
  }

  async linkGoogleId(userId: string, googleId: string): Promise<void> {
    await this.users.update({ id: userId }, { googleId, emailVerified: true });
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

  async updateProfile(userId: string, updates: UpdateUserDto): Promise<void> {
    const patch: Partial<
      Pick<User, 'name' | 'email' | 'affiliation' | 'avatarUrl' | 'emailVerified'>
    > = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.affiliation !== undefined) patch.affiliation = updates.affiliation;
    if (updates.avatarUrl !== undefined) patch.avatarUrl = updates.avatarUrl;
    if (updates.email !== undefined) {
      patch.email = updates.email.trim().toLowerCase();
      const current = await this.findById(userId);
      if (current && patch.email !== current.email) patch.emailVerified = false;
    }
    if (Object.keys(patch).length === 0) return;

    try {
      await this.users.update({ id: userId }, patch);
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    // Explicit response projection: never expose credentials or Google identifiers.
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      affiliation: user.affiliation,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateSelf(userId: string, input: UpdateUserDto) {
    if (
      [input.email, input.name, input.affiliation, input.avatarUrl].every(
        (value) => value === undefined,
      )
    ) {
      throw new BadRequestException('At least one profile field is required');
    }
    await this.getProfile(userId);
    await this.updateProfile(userId, input);
    return this.getProfile(userId);
  }

  async remove(userId: string): Promise<void> {
    const result = await this.users.delete({ id: userId });
    if (!result.affected) throw new NotFoundException('User not found');
  }

  private async save(user: User): Promise<User> {
    try {
      return await this.users.save(user);
    } catch (error) {
      return this.rethrowDatabaseError(error);
    }
  }

  private rethrowDatabaseError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new ConflictException('An account with this email or Google identity already exists');
    }
    throw error;
  }
}
