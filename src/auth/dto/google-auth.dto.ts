import { IsString, MaxLength } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @MaxLength(4000)
  idToken: string;
}
