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
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { CreateNewsletterDto } from './create-newsletter.dto';
import { UpdateNewsletterDto } from './update-newsletter.dto';
import { RolesGuard } from '../AdminModule/admin.roles-guards';
import { JwtAuthGuard } from '../AuthModule/jwt-auth.guard';
import { Roles } from '../AdminModule/admin.roles-decorators';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  // Public endpoint for newsletter subscription
  @Post('subscribe')
  async subscribe(@Body() createNewsletterDto: CreateNewsletterDto) {
    return this.newsletterService.subscribe(createNewsletterDto);
  }

  // Public endpoint for unsubscribing
  @Post('unsubscribe')
  async unsubscribe(@Body() unsubscribeData: { email: string; reason?: string }) {
    return this.newsletterService.unsubscribe(unsubscribeData.email, unsubscribeData.reason);
  }

  
  // Add this endpoint to your newsletter.controller.ts

  @Get('zoho-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async getZohoStatus() {
    return this.newsletterService.getZohoIntegrationStatus();
  }

  // Admin endpoints
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async findAll(@Query() query: any) {
    return this.newsletterService.findAll(query);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async getStats() {
    return this.newsletterService.getNewsletterStats();
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async exportSubscribers(@Query() query: any) {
    return this.newsletterService.exportSubscribers(query);
  }

  @Post('bulk-import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async bulkImport(@Body() importData: { subscribers: CreateNewsletterDto[] }) {
    return this.newsletterService.bulkImport(importData.subscribers);
  }

  @Post('sync-zoho')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async syncWithZoho() {
    return this.newsletterService.syncWithZoho();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async findOne(@Param('id') id: string) {
    return this.newsletterService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async update(
    @Param('id') id: string,
    @Body() updateNewsletterDto: UpdateNewsletterDto,
  ) {
    return this.newsletterService.update(id, updateNewsletterDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.newsletterService.remove(id);
  }

  @Patch(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async reactivate(@Param('id') id: string) {
    return this.newsletterService.reactivate(id);
  }

  @Post('send-campaign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1) // Admin role
  async sendCampaign(@Body() campaignData: {
    subject: string;
    content: string;
    interests?: string[];
    isActive?: boolean;
  }) {
    return this.newsletterService.sendCampaign(campaignData);
  }
}