import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ForgotPasswordDto } from './forgot-password.dto';
import { GoogleAuthDto } from './google-auth.dto';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { UpdateProfileDto } from './update-profile.dto';

describe('RegisterDto', () => {
  it('accepts a valid email + password', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'a@b.com', password: 'a-long-enough-password' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a malformed email', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'not-an-email', password: 'a-long-enough-password' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('rejects a too-short password', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'a@b.com', password: 'short' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('rejects a filled-in honeypot field (bot submission)', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'a-long-enough-password',
      website: 'https://spam.example.com',
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('accepts an empty/omitted honeypot field', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'a@b.com', password: 'a-long-enough-password', website: '' });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('LoginDto', () => {
  it('accepts a valid email + password', async () => {
    const dto = plainToInstance(LoginDto, { email: 'a@b.com', password: 'anything' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a filled-in honeypot field (bot submission)', async () => {
    const dto = plainToInstance(LoginDto, { email: 'a@b.com', password: 'anything', website: 'not-empty' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});

describe('ForgotPasswordDto', () => {
  it('accepts a valid email', async () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: 'a@b.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a malformed email', async () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: 'not-an-email' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('rejects a filled-in honeypot field (bot submission)', async () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: 'a@b.com', website: 'not-empty' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});

describe('ResetPasswordDto', () => {
  it('accepts a token + long-enough new password', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: 'abc123', newPassword: 'a-long-enough-password' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a too-short new password', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: 'abc123', newPassword: 'short' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('rejects a missing token', async () => {
    const dto = plainToInstance(ResetPasswordDto, { newPassword: 'a-long-enough-password' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});

describe('GoogleAuthDto', () => {
  it('accepts an idToken string', async () => {
    const dto = plainToInstance(GoogleAuthDto, { idToken: 'a.jwt.token' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing idToken', async () => {
    const dto = plainToInstance(GoogleAuthDto, {});
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});

describe('UpdateProfileDto', () => {
  it('accepts an empty body (a no-op update)', async () => {
    const dto = plainToInstance(UpdateProfileDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts name + email only', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: 'Jane Doe', email: 'jane@example.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a password change with both fields present', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      currentPassword: 'old-password',
      newPassword: 'a-long-enough-password',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a malformed email', async () => {
    const dto = plainToInstance(UpdateProfileDto, { email: 'not-an-email' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('rejects a too-short new password', async () => {
    const dto = plainToInstance(UpdateProfileDto, { newPassword: 'short' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
