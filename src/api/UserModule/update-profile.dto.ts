
// user/dto/update-profile.dto.ts
import { IsOptional, IsString, IsNumber, IsEmail, MaxLength, MinLength, Min, Max } from 'class-validator';

export class UpdateProfileDto {
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

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @IsOptional()
  @IsString()
  phone?: string;

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
}