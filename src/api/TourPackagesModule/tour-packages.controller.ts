import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TourPackagesService } from './tour-packages.service';
import { CreateTourPackageDto } from './create-tour-package.dto';
import { UpdateTourPackageDto } from './update-tour-package.dto';
import { RolesGuard } from '../AdminModule/admin.roles-guards';
import { JwtAuthGuard } from '../AuthModule/jwt-auth.guard';
import { Roles } from '../AdminModule/admin.roles-decorators'; // Use the correct decorator

@Controller('tour-packages')
export class TourPackagesController {
  constructor(private readonly tourPackagesService: TourPackagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard) // Ensure JwtAuthGuard comes first
  @Roles(1) // Admin role
  async create(@Body() createTourPackageDto: CreateTourPackageDto) {
    console.log('Creating tour package with data:', createTourPackageDto);
    return this.tourPackagesService.create(createTourPackageDto);
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.tourPackagesService.findAll(query);
  }

  @Get('search')
  async searchAndFilter(@Query() filters: any) {
    return this.tourPackagesService.searchAndFilter(filters);
  }

  @Get('featured')
  async findFeatured() {
    return this.tourPackagesService.findFeatured();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async getStats() {
    return this.tourPackagesService.getTourStats();
  }

  @Get('category/:category')
  async findByCategory(@Param('category') category: string) {
    return this.tourPackagesService.findByCategory(category);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.tourPackagesService.findBySlug(slug);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tourPackagesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async update(
    @Param('id') id: string,
    @Body() updateTourPackageDto: UpdateTourPackageDto,
  ) {
    return this.tourPackagesService.update(id, updateTourPackageDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async toggleActive(@Param('id') id: string) {
    return this.tourPackagesService.toggleActive(id);
  }

  @Patch(':id/toggle-featured')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async toggleFeatured(@Param('id') id: string) {
    return this.tourPackagesService.toggleFeatured(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.tourPackagesService.remove(id);
  }
}