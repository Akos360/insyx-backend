import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  affiliation?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  // Required only when newPassword is set on an account that already has a password; enforced in AuthService.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  newPassword?: string;
}
