import { IsEmail, MaxLength } from 'class-validator';

// auth/dto/forgot-password.dto.ts
export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(150)
  email: string;
}