import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { isHttps } from '../common/is-https.util';
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from './auth.constants';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type { AccessTokenPayload, AuthUserResponse } from './auth.types';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Tighter than the app's 300/60s global default — login/register need real brute-force resistance.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

function cookieOptions(req: Request, maxAgeMs: number, path: string): CookieOptions {
  return {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path,
  };
}

function setAuthCookies(req: Request, res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, cookieOptions(req, ACCESS_TOKEN_TTL_MS, '/'));
  // Scoped to /auth/refresh only, so it isn't sent on every request.
  res.cookie('refresh_token', refreshToken, cookieOptions(req, REFRESH_TOKEN_TTL_MS, '/auth/refresh'));
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Create an account and start a session' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const user = await this.auth.register(dto.email, dto.password);
    const { accessToken, refreshToken } = await this.auth.issueTokens(user);
    setAuthCookies(req, res, accessToken, refreshToken);
    return { id: user.id, email: user.email, name: user.name, affiliation: user.affiliation };
  }

  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and start a session' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const user = await this.auth.validateCredentials(dto.email, dto.password);
    const { accessToken, refreshToken } = await this.auth.issueTokens(user);
    setAuthCookies(req, res, accessToken, refreshToken);
    return { id: user.id, email: user.email, name: user.name, affiliation: user.affiliation };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the current session' })
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    return { success: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh cookie for a new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    const accessToken = await this.auth.refreshAccessToken(refreshToken);
    res.cookie('access_token', accessToken, cookieOptions(req, ACCESS_TOKEN_TTL_MS, '/'));
    return { success: true };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Who the current session belongs to' })
  me(@Req() req: Request & { user?: AccessTokenPayload }): Promise<AuthUserResponse> {
    return this.auth.me(req.user!.sub);
  }

  @UseGuards(AuthGuard)
  @Throttle(AUTH_THROTTLE)
  @Patch('me')
  @ApiOperation({ summary: "Update the current user's name, email, and/or password" })
  updateMe(
    @Req() req: Request & { user?: AccessTokenPayload },
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUserResponse> {
    return this.auth.updateProfile(req.user!.sub, dto);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password-reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.auth.requestPasswordReset(dto.email);
    // Same response regardless of whether the email is registered — prevents account enumeration.
    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  @Throttle(AUTH_THROTTLE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password from a reset link and start a session' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const user = await this.auth.resetPassword(dto.token, dto.newPassword);
    const { accessToken, refreshToken } = await this.auth.issueTokens(user);
    setAuthCookies(req, res, accessToken, refreshToken);
    return { id: user.id, email: user.email, name: user.name, affiliation: user.affiliation };
  }

  @Throttle(AUTH_THROTTLE)
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in or register via a Google ID token' })
  async google(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const user = await this.auth.loginWithGoogle(dto.idToken);
    const { accessToken, refreshToken } = await this.auth.issueTokens(user);
    setAuthCookies(req, res, accessToken, refreshToken);
    return { id: user.id, email: user.email, name: user.name, affiliation: user.affiliation };
  }
}
