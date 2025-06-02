// auth/dto/login.dto.ts
import { IsEmail, IsString,MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;
}