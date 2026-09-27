import { randomBytes, createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from './auth.constants';
import { MailerService } from './mailer.service';
import type { AccessTokenPayload, AuthUserResponse, RefreshTokenPayload } from './auth.types';
import type { UpdateProfileDto } from './dto/update-profile.dto';

const BCRYPT_ROUNDS = 10;
// Same message for unknown email and wrong password, so login never reveals whether an account exists.
const INVALID_CREDENTIALS = 'Invalid email or password';
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  async register(email: string, password: string): Promise<User> {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return this.users.create(email, passwordHash);
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);

    // Google-only account — never had a local password to check against.
    if (!user.passwordHash) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException(INVALID_CREDENTIALS);

    return user;
  }

  // Resolves the same way whether or not the email exists, to prevent account enumeration.
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.users.setResetToken(user.id, tokenHash, expiresAt);

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://127.0.0.1:8081');
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await this.mailer.sendPasswordResetEmail(user.email, resetUrl);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<User> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const user = await this.users.findByResetTokenHash(tokenHash);
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.users.updatePassword(user.id, passwordHash);
    await this.users.clearResetToken(user.id);

    return { ...user, passwordHash };
  }

  async loginWithGoogle(idToken: string): Promise<User> {
    const ticket = await this.googleClient
      .verifyIdToken({ idToken, audience: this.config.get<string>('GOOGLE_CLIENT_ID') })
      .catch(() => {
        throw new UnauthorizedException('Invalid Google credential');
      });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Invalid Google credential');
    }
    const { sub: googleId, email } = payload;

    const byGoogleId = await this.users.findByGoogleId(googleId);
    if (byGoogleId) return byGoogleId;

    const byEmail = await this.users.findByEmail(email);
    if (byEmail) {
      await this.users.linkGoogleId(byEmail.id, googleId);
      return { ...byEmail, googleId };
    }

    return this.users.createFromGoogle(email, googleId);
  }

  async issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload: AccessTokenPayload = { sub: user.id, email: user.email, type: 'access' };
    const refreshPayload: RefreshTokenPayload = { sub: user.id, type: 'refresh' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { expiresIn: ACCESS_TOKEN_TTL }),
      this.jwt.signAsync(refreshPayload, { expiresIn: REFRESH_TOKEN_TTL }),
    ]);

    return { accessToken, refreshToken };
  }

  // Stateless refresh, no revocation list — logout just clears cookies.
  async refreshAccessToken(refreshToken: string): Promise<string> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    const accessPayload: AccessTokenPayload = { sub: user.id, email: user.email, type: 'access' };
    return this.jwt.signAsync(accessPayload, { expiresIn: ACCESS_TOKEN_TTL });
  }

  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Invalid session');
    return toAuthUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUserResponse> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Invalid session');

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.users.findByEmail(dto.email);
      if (existing) throw new ConflictException('Email already registered');
    }

    if (dto.newPassword) {
      if (user.passwordHash) {
        if (!dto.currentPassword) {
          throw new BadRequestException('Current password is required to set a new password');
        }
        const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!valid) throw new BadRequestException('Current password is incorrect');
      }
      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
      await this.users.updatePassword(userId, passwordHash);
    }

    await this.users.updateProfile(userId, { name: dto.name, email: dto.email, affiliation: dto.affiliation });

    const updated = await this.users.findById(userId);
    return toAuthUser(updated!);
  }
}

function toAuthUser(user: User): AuthUserResponse {
  return { id: user.id, email: user.email, name: user.name, affiliation: user.affiliation };
}
