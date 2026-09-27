import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import type { User } from '../users/user.entity';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { MailerService } from './mailer.service';

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'person@example.com',
    name: null,
    affiliation: null,
    passwordHash: '',
    googleId: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let users: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    findByGoogleId: jest.Mock;
    createFromGoogle: jest.Mock;
    linkGoogleId: jest.Mock;
    setResetToken: jest.Mock;
    findByResetTokenHash: jest.Mock;
    clearResetToken: jest.Mock;
    updatePassword: jest.Mock;
    updateProfile: jest.Mock;
  };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let mailer: { sendPasswordResetEmail: jest.Mock };
  let config: { get: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    mockVerifyIdToken.mockReset();
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByGoogleId: jest.fn(),
      createFromGoogle: jest.fn(),
      linkGoogleId: jest.fn(),
      setResetToken: jest.fn(),
      findByResetTokenHash: jest.fn(),
      clearResetToken: jest.fn(),
      updatePassword: jest.fn(),
      updateProfile: jest.fn(),
    };
    jwt = { signAsync: jest.fn(async () => 'signed-token'), verifyAsync: jest.fn() };
    mailer = { sendPasswordResetEmail: jest.fn() };
    config = { get: jest.fn(() => 'test-google-client-id') };
    service = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
      mailer as unknown as MailerService,
      config as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('hashes the password and creates the user when the email is new', async () => {
      users.findByEmail.mockResolvedValue(null);
      // Mirrors real UsersService.create, which lower-cases the email itself.
      users.create.mockImplementation(async (email: string, passwordHash: string) =>
        makeUser({ email: email.toLowerCase(), passwordHash }),
      );

      const user = await service.register('Person@Example.com', 'a-long-enough-password');

      expect(users.findByEmail).toHaveBeenCalledWith('Person@Example.com');
      const [, passwordHash] = users.create.mock.calls[0];
      expect(passwordHash).not.toBe('a-long-enough-password');
      expect(await bcrypt.compare('a-long-enough-password', passwordHash)).toBe(true);
      expect(user.email).toBe('person@example.com');
    });

    it('rejects a duplicate email', async () => {
      users.findByEmail.mockResolvedValue(makeUser());

      await expect(service.register('person@example.com', 'a-long-enough-password')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('validateCredentials', () => {
    it('returns the user when the password matches', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      users.findByEmail.mockResolvedValue(makeUser({ passwordHash }));

      const user = await service.validateCredentials('person@example.com', 'correct-password');
      expect(user.email).toBe('person@example.com');
    });

    it('rejects an unknown email with a generic message', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(service.validateCredentials('nobody@example.com', 'whatever')).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('rejects a wrong password with the SAME generic message (no user enumeration)', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      users.findByEmail.mockResolvedValue(makeUser({ passwordHash }));

      await expect(service.validateCredentials('person@example.com', 'wrong-password')).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('throws UnauthorizedException in both failure cases', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(service.validateCredentials('nobody@example.com', 'x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('issueTokens', () => {
    it('signs an access token and a refresh token with distinct payload types', async () => {
      await service.issueTokens(makeUser());

      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', email: 'person@example.com', type: 'access' }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', type: 'refresh' }),
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('issues a new access token for a valid refresh token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh' });
      users.findById.mockResolvedValue(makeUser());

      const token = await service.refreshAccessToken('a-refresh-jwt');

      expect(token).toBe('signed-token');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', email: 'person@example.com', type: 'access' }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
    });

    it('rejects a token whose payload type is not "refresh" (e.g. an access token reused here)', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'person@example.com', type: 'access' });

      await expect(service.refreshAccessToken('an-access-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an invalid/expired token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.refreshAccessToken('garbage')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a refresh token for a user that no longer exists', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'deleted-user', type: 'refresh' });
      users.findById.mockResolvedValue(null);

      await expect(service.refreshAccessToken('a-refresh-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('returns id/email for a known user', async () => {
      users.findById.mockResolvedValue(makeUser());
      await expect(service.me('user-1')).resolves.toEqual({ id: 'user-1', email: 'person@example.com', name: null, affiliation: null });
    });

    it('rejects an unknown user id', async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.me('ghost')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('validateCredentials — Google-only account', () => {
    it('rejects password login for an account with no local password (same generic message)', async () => {
      users.findByEmail.mockResolvedValue(makeUser({ passwordHash: null, googleId: 'google-sub-1' }));

      await expect(service.validateCredentials('person@example.com', 'anything')).rejects.toThrow(
        'Invalid email or password',
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('stores a hashed token and emails the reset link when the email exists', async () => {
      users.findByEmail.mockResolvedValue(makeUser());

      await service.requestPasswordReset('person@example.com');

      expect(users.setResetToken).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(Date));
      const [, tokenHash] = users.setResetToken.mock.calls[0];
      expect(tokenHash).toHaveLength(64); // hex-encoded sha256
      expect(mailer.sendPasswordResetEmail).toHaveBeenCalledWith(
        'person@example.com',
        expect.stringContaining('/reset-password?token='),
      );
    });

    it('does nothing (no error, no email) when the email is unknown — no enumeration', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(service.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
      expect(users.setResetToken).not.toHaveBeenCalled();
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('sets a new password and clears the token for a valid, unexpired token', async () => {
      users.findByResetTokenHash.mockResolvedValue(
        makeUser({ resetTokenExpiresAt: new Date(Date.now() + 60_000) }),
      );

      const user = await service.resetPassword('a-raw-token', 'a-new-long-password');

      expect(users.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
      const [, newHash] = users.updatePassword.mock.calls[0];
      expect(await bcrypt.compare('a-new-long-password', newHash)).toBe(true);
      expect(users.clearResetToken).toHaveBeenCalledWith('user-1');
      expect(user.email).toBe('person@example.com');
    });

    it('rejects an unknown token', async () => {
      users.findByResetTokenHash.mockResolvedValue(null);

      await expect(service.resetPassword('garbage', 'a-new-long-password')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(users.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      users.findByResetTokenHash.mockResolvedValue(
        makeUser({ resetTokenExpiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.resetPassword('a-raw-token', 'a-new-long-password')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(users.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('loginWithGoogle', () => {
    function mockGooglePayload(payload: Record<string, unknown>) {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
    }

    it('returns the existing user when the Google id is already linked', async () => {
      mockGooglePayload({ sub: 'google-sub-1', email: 'person@example.com', email_verified: true });
      users.findByGoogleId.mockResolvedValue(makeUser({ googleId: 'google-sub-1' }));

      const user = await service.loginWithGoogle('a-valid-id-token');
      expect(user.email).toBe('person@example.com');
      expect(users.createFromGoogle).not.toHaveBeenCalled();
    });

    it('links the Google id to an existing password account with the same email', async () => {
      mockGooglePayload({ sub: 'google-sub-2', email: 'person@example.com', email_verified: true });
      users.findByGoogleId.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(makeUser({ passwordHash: 'existing-hash' }));

      const user = await service.loginWithGoogle('a-valid-id-token');
      expect(users.linkGoogleId).toHaveBeenCalledWith('user-1', 'google-sub-2');
      expect(user.googleId).toBe('google-sub-2');
    });

    it('creates a brand-new account when neither the Google id nor the email exist', async () => {
      mockGooglePayload({ sub: 'google-sub-3', email: 'new@example.com', email_verified: true });
      users.findByGoogleId.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(null);
      users.createFromGoogle.mockResolvedValue(makeUser({ email: 'new@example.com', googleId: 'google-sub-3' }));

      const user = await service.loginWithGoogle('a-valid-id-token');
      expect(users.createFromGoogle).toHaveBeenCalledWith('new@example.com', 'google-sub-3');
      expect(user.email).toBe('new@example.com');
    });

    it('rejects an unverified email', async () => {
      mockGooglePayload({ sub: 'google-sub-4', email: 'unverified@example.com', email_verified: false });

      await expect(service.loginWithGoogle('a-valid-id-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token that fails Google verification', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('invalid signature'));

      await expect(service.loginWithGoogle('garbage')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    it('updates name and email when the new email is free', async () => {
      users.findById
        .mockResolvedValueOnce(makeUser({ email: 'old@example.com' }))
        .mockResolvedValueOnce(makeUser({ email: 'new@example.com', name: 'New Name' }));
      users.findByEmail.mockResolvedValue(null);

      const result = await service.updateProfile('user-1', { name: 'New Name', email: 'new@example.com' });

      expect(users.updateProfile).toHaveBeenCalledWith('user-1', {
        name: 'New Name',
        email: 'new@example.com',
      });
      expect(result).toEqual({ id: 'user-1', email: 'new@example.com', name: 'New Name', affiliation: null });
    });

    it('rejects changing to an email already used by another account', async () => {
      users.findById.mockResolvedValue(makeUser({ email: 'old@example.com' }));
      users.findByEmail.mockResolvedValue(makeUser({ id: 'someone-else', email: 'taken@example.com' }));

      await expect(
        service.updateProfile('user-1', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(users.updateProfile).not.toHaveBeenCalled();
    });

    it('allows keeping the same email unchanged without a uniqueness check', async () => {
      users.findById.mockResolvedValue(makeUser({ email: 'same@example.com' }));

      await service.updateProfile('user-1', { name: 'New Name', email: 'same@example.com' });

      expect(users.findByEmail).not.toHaveBeenCalled();
    });

    it('changes the password when the current password is correct', async () => {
      const passwordHash = await bcrypt.hash('old-password-123', 4);
      users.findById.mockResolvedValue(makeUser({ passwordHash }));

      await service.updateProfile('user-1', {
        currentPassword: 'old-password-123',
        newPassword: 'a-new-long-password',
      });

      expect(users.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
      const [, newHash] = users.updatePassword.mock.calls[0];
      expect(await bcrypt.compare('a-new-long-password', newHash)).toBe(true);
    });

    it('rejects a password change with a missing current password', async () => {
      const passwordHash = await bcrypt.hash('old-password-123', 4);
      users.findById.mockResolvedValue(makeUser({ passwordHash }));

      await expect(
        service.updateProfile('user-1', { newPassword: 'a-new-long-password' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects a password change with a wrong current password', async () => {
      const passwordHash = await bcrypt.hash('old-password-123', 4);
      users.findById.mockResolvedValue(makeUser({ passwordHash }));

      await expect(
        service.updateProfile('user-1', { currentPassword: 'wrong', newPassword: 'a-new-long-password' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.updatePassword).not.toHaveBeenCalled();
    });

    it('allows a Google-only account (no existing password) to set its first password without a current password', async () => {
      users.findById.mockResolvedValue(makeUser({ passwordHash: null, googleId: 'google-sub-1' }));

      await service.updateProfile('user-1', { newPassword: 'a-new-long-password' });

      expect(users.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
    });

    it('rejects an unknown user id', async () => {
      users.findById.mockResolvedValue(null);

      await expect(service.updateProfile('ghost', { name: 'X' })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
