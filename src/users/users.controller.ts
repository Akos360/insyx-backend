import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@ApiTags('users')
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  me(@Req() req: AuthenticatedRequest) {
    return this.users.getProfile(req.user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  update(
    @Req() req: AuthenticatedRequest,
    @Body(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    )
    input: UpdateUserDto,
  ) {
    return this.users.updateSelf(req.user.sub, input);
  }

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete the current account and clear session cookies' })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.users.remove(req.user.sub);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
  }
}
