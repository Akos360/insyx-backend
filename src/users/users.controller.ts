import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserInputPipe } from './user-input.pipe';
import { User } from './user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a user profile (does not authenticate or verify email)',
  })
  @ApiResponse({ status: 201, type: User })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body(new UserInputPipe()) input: CreateUserDto) {
    return this.users.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List user profiles with pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  findAll(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw new BadRequestException(
        'Limit must be 1–100 and offset must be non-negative',
      );
    }
    return this.users.findAll(limit, offset);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: User })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new UserInputPipe(true)) input: UpdateUserDto,
  ) {
    return this.users.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.users.remove(id);
  }
}
