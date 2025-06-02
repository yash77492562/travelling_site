// auth/auth.verify-email.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  verificationToken: string;
}