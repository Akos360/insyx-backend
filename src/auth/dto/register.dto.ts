import { IsEmail, IsEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password: string;

  // Honeypot: hidden via CSS on the frontend, so any value here means a bot filled it.
  @IsOptional()
  @IsEmpty()
  website?: string;
}
