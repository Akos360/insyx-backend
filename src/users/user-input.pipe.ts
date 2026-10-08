import { BadRequestException, PipeTransform } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

// Scoped to users: existing endpoints do not change their validation behavior.
export class UserInputPipe
  implements PipeTransform<unknown, Partial<CreateUserDto>>
{
  constructor(private readonly partial = false) {}

  transform(value: unknown): Partial<CreateUserDto> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Body must be an object');
    }
    const input = value as Record<string, unknown>;
    const allowed = ['email', 'displayName', 'avatarUrl'];
    if (Object.keys(input).some((key) => !allowed.includes(key))) {
      throw new BadRequestException(
        'Only email, displayName and avatarUrl are allowed',
      );
    }
    if (this.partial && Object.keys(input).length === 0) {
      throw new BadRequestException('At least one profile field is required');
    }
    const result: Partial<CreateUserDto> = {};
    if (!this.partial || 'email' in input) {
      if (typeof input.email !== 'string') {
        throw new BadRequestException('Email is required');
      }
      const email = input.email.trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Email must be a valid email address');
      }
      result.email = email;
    }
    if (!this.partial || 'displayName' in input) {
      if (typeof input.displayName !== 'string') {
        throw new BadRequestException('Display name is required');
      }
      const name = input.displayName.trim();
      if (!name || name.length > 100) {
        throw new BadRequestException('Display name must contain 1–100 characters');
      }
      result.displayName = name;
    }
    if ('avatarUrl' in input) {
      if (input.avatarUrl === null) {
        result.avatarUrl = null;
      } else {
        if (
          typeof input.avatarUrl !== 'string' ||
          input.avatarUrl.length > 2048
        ) {
          throw new BadRequestException('Avatar URL must be an HTTP(S) URL or null');
        }
        try {
          const url = new URL(input.avatarUrl);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password
          ) {
            throw new Error('Invalid avatar URL');
          }
        } catch {
          throw new BadRequestException('Avatar URL must be an HTTP(S) URL or null');
        }
        result.avatarUrl = input.avatarUrl;
      }
    }
    return result;
  }
}
