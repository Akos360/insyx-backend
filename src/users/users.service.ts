import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(input: CreateUserDto): Promise<User> {
    const user = this.users.create({
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      avatarUrl: input.avatarUrl ?? null,
      emailVerified: false,
      lastLoginAt: null,
    });
    await this.save(user);
    return this.findOne(user.id);
  }

  async findAll(limit = 20, offset = 0) {
    const [items, total] = await this.users.findAndCount({
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    return { items, total, limit, offset };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, input: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (email !== user.email) {
        // Email changes on linked accounts belong in a future verified-email flow.
        const linked = await this.users
          .createQueryBuilder('user')
          .addSelect('user.googleSubject')
          .where('user.id = :id', { id })
          .getOne();
        if (linked?.googleSubject) {
          throw new ConflictException(
            'A Google-linked email cannot be changed through the profile API',
          );
        }
        user.email = email;
        user.emailVerified = false;
      }
    }
    if (input.displayName !== undefined) {
      user.displayName = input.displayName.trim();
    }
    if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
    await this.save(user);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.users.delete(id);
    if (!result.affected) throw new NotFoundException('User not found');
  }

  private async save(user: User): Promise<void> {
    try {
      await this.users.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }
}
