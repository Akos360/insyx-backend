import { IsEmail, IsEmpty, IsOptional, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(200)
  email: string;

  // Honeypot — see RegisterDto.
  @IsOptional()
  @IsEmpty()
  website?: string;
}
