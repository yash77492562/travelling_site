import { PartialType } from '@nestjs/mapped-types';
import { IsEmail, IsString, IsOptional, IsNumber, IsBoolean, MaxLength, MinLength, Min, Max, IsDateString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @IsOptional()
    @IsEmail()
    @MaxLength(150)
    email?: string;

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
    @MinLength(6)
    @MaxLength(100)
    password?: string;

    @IsOptional()
    @IsBoolean()
    status?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    role?: number;

    @IsOptional()
    @IsBoolean()
    is_deleted?: boolean;

    @IsOptional()
    @IsDateString()
    is_deleted_date?: string;
}