import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TourPackage } from '../../schemas/tour-package.schema';
import { CreateTourPackageDto } from './create-tour-package.dto';
import { UpdateTourPackageDto } from './update-tour-package.dto';

@Injectable()
export class TourPackagesService {
  constructor(
    @InjectModel(TourPackage.name) private tourPackageModel: Model<TourPackage>,
  ) {}

  async create(createTourPackageDto: CreateTourPackageDto): Promise<TourPackage> {
    // Generate slug if not provided
    if (!createTourPackageDto.slug) {
      createTourPackageDto.slug = this.generateSlug(createTourPackageDto.title);
    }

    // Ensure slug is unique
    const existingPackage = await this.tourPackageModel.findOne({ 
      slug: createTourPackageDto.slug 
    });
    
    if (existingPackage) {
      createTourPackageDto.slug = `${createTourPackageDto.slug}-${Date.now()}`;
    }

    const tourPackage = new this.tourPackageModel(createTourPackageDto);
    return tourPackage.save();
  }

  async findAll(filters?: any): Promise<TourPackage[]> {
    const query: any = { is_deleted: false };
    
    // Clean and parse filters
    if (filters?.category) {
      query.category = filters.category.toString().trim();
    }
    
    // Handle boolean filters with proper parsing
    if (filters?.is_active !== undefined) {
      const isActiveValue = filters.is_active.toString().toLowerCase().trim();
      query.is_active = isActiveValue === 'true';
    }
    
    if (filters?.is_featured !== undefined) {
      const isFeaturedValue = filters.is_featured.toString().toLowerCase().trim();
      query.is_featured = isFeaturedValue === 'true';
    }
    
    if (filters?.location) {
      query.location = { $regex: filters.location.toString().trim(), $options: 'i' };
    }
    
    // Price range filter
    if (filters?.min_price || filters?.max_price) {
      query.price = {};
      if (filters.min_price) {
        const minPrice = Number(filters.min_price.toString().trim());
        if (!isNaN(minPrice)) query.price.$gte = minPrice;
      }
      if (filters.max_price) {
        const maxPrice = Number(filters.max_price.toString().trim());
        if (!isNaN(maxPrice)) query.price.$lte = maxPrice;
      }
    }

    // Date availability filter
    if (filters?.available_from || filters?.available_to) {
      try {
        if (filters.available_from) {
          const fromDate = new Date(filters.available_from.toString().trim());
          if (!isNaN(fromDate.getTime())) {
            query.available_from = { $lte: fromDate };
          }
        }
        if (filters.available_to) {
          const toDate = new Date(filters.available_to.toString().trim());
          if (!isNaN(toDate.getTime())) {
            query.available_to = { $gte: toDate };
          }
        }
      } catch (error) {
        console.error('Date parsing error:', error);
      }
    }

    // Search by title, description, or location
    if (filters?.search) {
      const searchTerm = filters.search.toString().trim();
      if (searchTerm) {
        query.$or = [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { location: { $regex: searchTerm, $options: 'i' } }
        ];
      }
    }

    // Sorting
    let sort: any = { createdAt: -1 };
    if (filters?.sort) {
      try {
        sort = JSON.parse(filters.sort);
      } catch {
        sort = { createdAt: -1 };
      }
    }

    // Pagination
    const limit = filters?.limit ? Math.max(0, Number(filters.limit.toString().trim())) : 0;
    const skip = filters?.skip ? Math.max(0, Number(filters.skip.toString().trim())) : 0;

    console.log('Query:', JSON.stringify(query, null, 2)); // Debug log

    return this.tourPackageModel
      .find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .exec();
  }

  async findFeatured(): Promise<TourPackage[]> {
    return this.tourPackageModel
      .find({ 
        is_deleted: false, 
        is_active: true, 
        is_featured: true 
      })
      .sort({ createdAt: -1 })
      .limit(6)
      .exec();
  }

  async findByCategory(category: string): Promise<TourPackage[]> {
    // Validate category
    const validCategories = ['tours', 'weekend-getaways', 'ladakh-specials'];
    const cleanCategory = category.toString().trim().toLowerCase();
    
    if (!validCategories.includes(cleanCategory)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    const query = { 
      category: cleanCategory, 
      is_deleted: false, 
      is_active: true 
    };

    console.log('Category query:', JSON.stringify(query, null, 2)); // Debug log
    
    return this.tourPackageModel
      .find(query)
      .sort({ is_featured: -1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<TourPackage> {
    const tourPackage = await this.tourPackageModel
      .findOne({ _id: id, is_deleted: false })
      .exec();
    
    if (!tourPackage) {
      throw new NotFoundException('Tour package not found');
    }
    
    return tourPackage;
  }

  async findBySlug(slug: string): Promise<TourPackage> {
    const cleanSlug = slug.toString().trim().toLowerCase();
    
    if (!cleanSlug) {
      throw new BadRequestException('Slug cannot be empty');
    }

    const query = { 
      slug: cleanSlug, 
      is_deleted: false, 
      is_active: true 
    };

    console.log('Slug query:', JSON.stringify(query, null, 2)); // Debug log
    
    const tourPackage = await this.tourPackageModel
      .findOne(query)
      .exec();
    
    if (!tourPackage) {
      throw new NotFoundException(`Tour package with slug '${cleanSlug}' not found`);
    }
    
    return tourPackage;
  }

  async update(id: string, updateTourPackageDto: UpdateTourPackageDto): Promise<TourPackage> {
    // Handle slug update
    if (updateTourPackageDto.title && !updateTourPackageDto.slug) {
      updateTourPackageDto.slug = this.generateSlug(updateTourPackageDto.title);
    }

    // Check slug uniqueness if updating slug
    if (updateTourPackageDto.slug) {
      const existingPackage = await this.tourPackageModel.findOne({ 
        slug: updateTourPackageDto.slug,
        _id: { $ne: id }
      });
      
      if (existingPackage) {
        throw new BadRequestException('Slug already exists');
      }
    }

    const tourPackage = await this.tourPackageModel
      .findOneAndUpdate(
        { _id: id, is_deleted: false },
        updateTourPackageDto,
        { new: true }
      )
      .exec();
    
    if (!tourPackage) {
      throw new NotFoundException('Tour package not found');
    }
    
    return tourPackage;
  }

  async remove(id: string): Promise<void> {
    const tourPackage = await this.tourPackageModel.findById(id);
    
    if (!tourPackage) {
      throw new NotFoundException('Tour package not found');
    }

    tourPackage.is_deleted = true;
    tourPackage.is_deleted_date = new Date();
    await tourPackage.save();
  }

  async toggleActive(id: string): Promise<TourPackage> {
    const tourPackage = await this.tourPackageModel.findOne({ 
      _id: id, 
      is_deleted: false 
    });
    
    if (!tourPackage) {
      throw new NotFoundException('Tour package not found');
    }

    tourPackage.is_active = !tourPackage.is_active;
    return tourPackage.save();
  }

  async toggleFeatured(id: string): Promise<TourPackage> {
    const tourPackage = await this.tourPackageModel.findOne({ 
      _id: id, 
      is_deleted: false 
    });
    
    if (!tourPackage) {
      throw new NotFoundException('Tour package not found');
    }

    tourPackage.is_featured = !tourPackage.is_featured;
    return tourPackage.save();
  }

  async searchAndFilter(filters: {
    search?: string;
    category?: string;
    location?: string;
    min_price?: number;
    max_price?: number;
    duration?: string;
    difficulty_level?: string;
    available_from?: Date;
    available_to?: Date;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{ packages: TourPackage[]; total: number; page: number; totalPages: number }> {
    const query: any = { is_deleted: false, is_active: true };

    // Build search query with proper string handling
    if (filters.search) {
      const searchTerm = filters.search.toString().trim();
      if (searchTerm) {
        query.$or = [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { location: { $regex: searchTerm, $options: 'i' } }
        ];
      }
    }

    // Apply filters with proper type conversion
    if (filters.category) {
      const cleanCategory = filters.category.toString().trim().toLowerCase();
      const validCategories = ['tours', 'weekend-getaways', 'ladakh-specials'];
      if (validCategories.includes(cleanCategory)) {
        query.category = cleanCategory;
      }
    }
    
    if (filters.location) {
      const cleanLocation = filters.location.toString().trim();
      if (cleanLocation) {
        query.location = { $regex: cleanLocation, $options: 'i' };
      }
    }
    
    if (filters.difficulty_level) {
      const cleanDifficulty = filters.difficulty_level.toString().trim();
      if (cleanDifficulty) {
        query.difficulty_level = cleanDifficulty;
      }
    }
    
    if (filters.duration) {
      const cleanDuration = filters.duration.toString().trim();
      if (cleanDuration) {
        query.duration = { $regex: cleanDuration, $options: 'i' };
      }
    }

    // Price range with proper number conversion
    if (filters.min_price !== undefined || filters.max_price !== undefined) {
      query.price = {};
      if (filters.min_price !== undefined) {
        const minPrice = Number(filters.min_price);
        if (!isNaN(minPrice) && minPrice >= 0) {
          query.price.$gte = minPrice;
        }
      }
      if (filters.max_price !== undefined) {
        const maxPrice = Number(filters.max_price);
        if (!isNaN(maxPrice) && maxPrice >= 0) {
          query.price.$lte = maxPrice;
        }
      }
    }

    // Date availability with proper date handling
    if (filters.available_from || filters.available_to) {
      try {
        if (filters.available_from) {
          const fromDate = new Date(filters.available_from);
          if (!isNaN(fromDate.getTime())) {
            query.available_from = { $lte: fromDate };
          }
        }
        if (filters.available_to) {
          const toDate = new Date(filters.available_to);
          if (!isNaN(toDate.getTime())) {
            query.available_to = { $gte: toDate };
          }
        }
      } catch (error) {
        console.error('Date parsing error:', error);
      }
    }

    // Sorting with proper validation
    const sortOptions: any = {};
    if (filters.sort_by) {
      const validSortFields = ['title', 'price', 'duration', 'createdAt', 'is_featured'];
      const cleanSortBy = filters.sort_by.toString().trim();
      if (validSortFields.includes(cleanSortBy)) {
        sortOptions[cleanSortBy] = filters.sort_order === 'desc' ? -1 : 1;
      }
    } else {
      sortOptions.is_featured = -1;
      sortOptions.createdAt = -1;
    }

    // Pagination with proper validation
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 12)); // Max 100 items per page
    const skip = (page - 1) * limit;

    console.log('Search query:', JSON.stringify(query, null, 2)); // Debug log
    console.log('Sort options:', JSON.stringify(sortOptions, null, 2)); // Debug log

    const [packages, total] = await Promise.all([
      this.tourPackageModel.find(query).sort(sortOptions).skip(skip).limit(limit).exec(),
      this.tourPackageModel.countDocuments(query)
    ]);

    return {
      packages,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getTourStats(): Promise<any> {
    const stats = await this.tourPackageModel.aggregate([
      { $match: { is_deleted: false } },
      {
        $group: {
          _id: null,
          total_tours: { $sum: 1 },
          active_tours: {
            $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] }
          },
          featured_tours: {
            $sum: { $cond: [{ $eq: ['$is_featured', true] }, 1, 0] }
          },
          average_price: { $avg: '$price' },
          min_price: { $min: '$price' },
          max_price: { $max: '$price' }
        }
      }
    ]);

    const categoryStats = await this.tourPackageModel.aggregate([
      { $match: { is_deleted: false } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          average_price: { $avg: '$price' }
        }
      }
    ]);

    const locationStats = await this.tourPackageModel.aggregate([
      { $match: { is_deleted: false, is_active: true } },
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return {
      ...stats[0],
      category_breakdown: categoryStats,
      popular_locations: locationStats
    };
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}