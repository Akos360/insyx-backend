import { IsEmail, IsEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;

  // Honeypot — see RegisterDto.
  @IsOptional()
  @IsEmpty()
  website?: string;
}
