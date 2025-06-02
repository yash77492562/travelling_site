import { PartialType } from '@nestjs/mapped-types';
import { CreateBookingDto } from './create-booking.dto';
import { IsOptional, IsEnum, IsDateString, IsString, IsNumber } from 'class-validator';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  @IsOptional()
  @IsEnum(['pending', 'confirmed', 'cancelled', 'completed'])
  booking_status?: string;

  @IsOptional()
  @IsEnum(['pending', 'paid', 'failed', 'refunded'])
  payment_status?: string;

  @IsOptional()
  @IsString()
  payment_id?: string;

  @IsOptional()
  @IsString()
  razorpay_order_id?: string;

  @IsOptional()
  @IsString()
  razorpay_signature?: string;

  @IsOptional()
  @IsString()
  cancellation_reason?: string;

  @IsOptional()
  @IsDateString()
  cancelled_at?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @IsOptional()
  @IsNumber()
  refund_amount?: number;

  @IsOptional()
  @IsDateString()
  refund_date?: string;

  @IsOptional()
  @IsString()
  refund_reference?: string;
}