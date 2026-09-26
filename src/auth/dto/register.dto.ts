import { IsEmail, IsEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password: string;

  // Honeypot — a real user never sees or fills this field (hidden via CSS on
  // the frontend). Any non-empty value here means the submitter is a bot.
  @IsOptional()
  @IsEmpty()
  website?: string;
}
