import { PartialType } from '@nestjs/mapped-types';
import { CreateTourPackageDto } from './create-tour-package.dto';
import { IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateTourPackageDto extends PartialType(CreateTourPackageDto) {
  @IsOptional()
  @IsNumber()
  @Min(0)
  current_bookings?: number;
}