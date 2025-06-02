import { 
  IsNotEmpty, 
  IsString, 
  IsNumber, 
  IsEnum, 
  IsArray, 
  IsOptional, 
  IsBoolean, 
  IsDateString,
  MaxLength,
  Min
} from 'class-validator';

export class CreateTourPackageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  short_description: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discounted_price?: number;

  @IsNotEmpty()
  @IsString()
  duration: string;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsNotEmpty()
  @IsEnum(['tours', 'weekend-getaways', 'ladakh-specials'])
  category: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsString()
  itinerary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  included?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excluded?: string[];

  @IsOptional()
  @IsString()
  terms_conditions?: string;

  @IsOptional()
  @IsDateString()
  available_from?: string;

  @IsOptional()
  @IsDateString()
  available_to?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_participants?: number = 0;

  @IsOptional()
  @IsString()
  meeting_point?: string;

  @IsOptional()
  @IsString()
  difficulty_level?: string;

  // SEO Fields
  @IsOptional()
  @IsString()
  meta_title?: string;

  @IsOptional()
  @IsString()
  meta_description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  meta_keywords?: string[];

  @IsOptional()
  @IsString()
  slug?: string;
}