
// user/dto/reset-password.dto.ts (Moved to user module)
import { IsString, MinLength, MaxLength } from 'class-validator';
export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;
}
