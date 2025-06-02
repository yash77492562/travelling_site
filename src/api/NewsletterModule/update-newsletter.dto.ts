
// update-newsletter.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean, IsString, IsDate } from 'class-validator';
import { CreateNewsletterDto } from './create-newsletter.dto';

export class UpdateNewsletterDto extends PartialType(CreateNewsletterDto) {
  @IsOptional()
  @IsBoolean()
  is_synced_with_zoho?: boolean;

  @IsOptional()
  @IsString()
  zoho_contact_id?: string;

  @IsOptional()
  @IsDate()
  unsubscribed_at?: Date;

  @IsOptional()
  @IsString()
  unsubscribe_reason?: string;

  @IsOptional()
  @IsDate()
  last_email_sent?: Date;

  @IsOptional()
  email_open_count?: number;

  @IsOptional()
  email_click_count?: number;
}