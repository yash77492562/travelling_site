import { IsString, MinLength, MaxLength } from 'class-validator';
// user/dto/change-password.dto.ts (Moved to user module)
export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  oldPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;
}