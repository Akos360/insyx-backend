import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 254 })
  email: string;

  @ApiProperty({ example: 'Alex Smith', maxLength: 100 })
  displayName: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.png',
    nullable: true,
    maxLength: 2048,
  })
  avatarUrl?: string | null;
}
