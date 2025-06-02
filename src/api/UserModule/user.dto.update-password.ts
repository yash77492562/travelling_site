
// user/dto/update-my-password.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateMyPasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  confirmPassword: string;
}