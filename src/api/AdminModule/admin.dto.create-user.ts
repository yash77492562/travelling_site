
// admin/dto/create-user.dto.ts
import { IsEmail, IsString, IsOptional, IsNumber, IsBoolean, MaxLength, MinLength, Min, Max } from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    @MaxLength(150)
    email: string;

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

    @IsString()
    @MinLength(6)
    @MaxLength(100)
    password: string;

    @IsOptional()
    @IsBoolean()
    status?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(3)
    role?: number;

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