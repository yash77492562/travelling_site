import { IsNotEmpty, IsString, IsNumber, IsEmail, IsDateString, IsArray, ValidateNested, IsOptional, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ParticipantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  age: number;

  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Other'])
  gender: string;

  @IsOptional()
  @IsString()
  id_proof_type?: string;

  @IsOptional()
  @IsString()
  id_proof_number?: string;
}

export class CreateBookingDto {
  user_id?: string; // Set by controller from auth

  @IsNotEmpty()
  @IsString()
  tour_package_id: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  participant_count: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  total_amount: number;

  @IsNotEmpty()
  @IsDateString()
  travel_date: string;

  @IsNotEmpty()
  @IsString()
  primary_contact_name: string;

  @IsNotEmpty()
  @IsString()
  primary_contact_phone: string;

  @IsNotEmpty()
  @IsEmail()
  primary_contact_email: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants?: ParticipantDto[];

  @IsOptional()
  @IsString()
  special_requirements?: string;

  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @IsOptional()
  @IsString()
  pickup_location?: string;
}