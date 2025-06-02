// auth/dto/register.dto.ts
import { IsEmail, IsString, IsOptional, IsNumber, MaxLength, MinLength, Min, Max } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(9999)
  phone_code?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000000000)
  @Max(99999999999)
  phone_number?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  lastName?: string;
}