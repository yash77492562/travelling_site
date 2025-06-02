import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Newsletter } from '../../schemas/newsletter.schema';
import { CreateNewsletterDto } from './create-newsletter.dto';
import { UpdateNewsletterDto } from './update-newsletter.dto';
import { ZohoOAuthService } from './zoho-OAuth/zoho-oauth.service'; // Import the new service

@Injectable()
export class NewsletterService {
  constructor(
    @InjectModel(Newsletter.name) private newsletterModel: Model<Newsletter>,
    private readonly zohoOAuthService: ZohoOAuthService, // Inject the Zoho OAuth service
  ) {}

  async subscribe(createNewsletterDto: CreateNewsletterDto): Promise<Newsletter> {
    // Check if email already exists
    const existingSubscriber = await this.newsletterModel.findOne({ 
      email: createNewsletterDto.email 
    });

    if (existingSubscriber) {
      if (existingSubscriber.is_active) {
        throw new ConflictException('Email already subscribed to newsletter');
      } else {
        // Reactivate existing subscription
        existingSubscriber.is_active = true;
        existingSubscriber.subscribed_at = new Date();
        existingSubscriber.unsubscribed_at = undefined;
        existingSubscriber.unsubscribe_reason = undefined;
        existingSubscriber.source = createNewsletterDto.source || 'website';
        
        if (createNewsletterDto.interests) {
          existingSubscriber.interests = createNewsletterDto.interests;
        }
        
        return existingSubscriber.save();
      }
    }

    const newsletter = new this.newsletterModel({
      ...createNewsletterDto,
      source: createNewsletterDto.source || 'website',
    });

    return newsletter.save();
  }

  async unsubscribe(email: string, reason?: string): Promise<{ message: string }> {
    const subscriber = await this.newsletterModel.findOne({ email, is_active: true });
    
    if (!subscriber) {
      throw new NotFoundException('Active subscription not found for this email');
    }

    subscriber.is_active = false;
    subscriber.unsubscribed_at = new Date();
    subscriber.unsubscribe_reason = reason || '';
    
    await subscriber.save();
    
    return { message: 'Successfully unsubscribed from newsletter' };
  }

  async findAll(filters?: any): Promise<Newsletter[]> {
    const query = { is_deleted: false };
    
    if (filters?.is_active !== undefined) query['is_active'] = filters.is_active === 'true';
    if (filters?.source) query['source'] = filters.source;
    if (filters?.interests) query['interests'] = { $in: filters.interests.split(',') };
    if (filters?.is_synced_with_zoho !== undefined) query['is_synced_with_zoho'] = filters.is_synced_with_zoho === 'true';
    
    if (filters?.subscribed_from || filters?.subscribed_to) {
      query['subscribed_at'] = {};
      if (filters.subscribed_from) query['subscribed_at']['$gte'] = new Date(filters.subscribed_from);
      if (filters.subscribed_to) query['subscribed_at']['$lte'] = new Date(filters.subscribed_to);
    }

    if (filters?.search) {
      query['$or'] = [
        { email: { $regex: filters.search, $options: 'i' } },
        { name: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const limit = parseInt(filters?.limit) || 50;
    const skip = (parseInt(filters?.page) - 1) * limit || 0;

    return this.newsletterModel
      .find(query)
      .sort({ subscribed_at: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
  }

  async findOne(id: string): Promise<Newsletter> {
    const newsletter = await this.newsletterModel
      .findOne({ _id: id, is_deleted: false })
      .exec();
    
    if (!newsletter) {
      throw new NotFoundException('Newsletter subscription not found');
    }
    
    return newsletter;
  }

  async update(id: string, updateNewsletterDto: UpdateNewsletterDto): Promise<Newsletter> {
    const newsletter = await this.newsletterModel.findOne({ _id: id, is_deleted: false });
    
    if (!newsletter) {
      throw new NotFoundException('Newsletter subscription not found');
    }

    // Check if email is being changed and if new email already exists
    if (updateNewsletterDto.email && updateNewsletterDto.email !== newsletter.email) {
      const existingEmail = await this.newsletterModel.findOne({ 
        email: updateNewsletterDto.email,
        _id: { $ne: id }
      });
      
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    Object.assign(newsletter, updateNewsletterDto);
    return newsletter.save();
  }

  async remove(id: string): Promise<void> {
    const newsletter = await this.newsletterModel.findById(id);
    
    if (!newsletter) {
      throw new NotFoundException('Newsletter subscription not found');
    }

    newsletter.is_deleted = true;
    newsletter.is_deleted_date = new Date();
    newsletter.is_active = false;
    
    await newsletter.save();
  }

  async reactivate(id: string): Promise<Newsletter> {
    const newsletter = await this.newsletterModel.findById(id);
    
    if (!newsletter) {
      throw new NotFoundException('Newsletter subscription not found');
    }

    newsletter.is_active = true;
    newsletter.subscribed_at = new Date();
    newsletter.unsubscribed_at = undefined;
    newsletter.unsubscribe_reason = undefined;
    
    return newsletter.save();
  }

  async bulkImport(subscribers: CreateNewsletterDto[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const subscriber of subscribers) {
      try {
        await this.subscribe({ ...subscriber, source: 'import' });
        imported++;
      } catch (error) {
        if (error instanceof ConflictException) {
          skipped++;
        } else {
          errors.push(`${subscriber.email}: ${error.message}`);
        }
      }
    }

    return { imported, skipped, errors };
  }

  async exportSubscribers(filters?: any): Promise<Newsletter[]> {
    const query = { is_deleted: false };
    
    if (filters?.is_active !== undefined) query['is_active'] = filters.is_active === 'true';
    if (filters?.source) query['source'] = filters.source;
    if (filters?.interests) query['interests'] = { $in: filters.interests.split(',') };
    
    return this.newsletterModel
      .find(query)
      .select('email name phone interests source subscribed_at is_active')
      .sort({ subscribed_at: -1 })
      .exec();
  }

  async getNewsletterStats(): Promise<any> {
    const stats = await this.newsletterModel.aggregate([
      { $match: { is_deleted: false } },
      {
        $group: {
          _id: null,
          total_subscribers: { $sum: 1 },
          active_subscribers: {
            $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] }
          },
          inactive_subscribers: {
            $sum: { $cond: [{ $eq: ['$is_active', false] }, 1, 0] }
          },
          synced_with_zoho: {
            $sum: { $cond: [{ $eq: ['$is_synced_with_zoho', true] }, 1, 0] }
          },
          not_synced_with_zoho: {
            $sum: { $cond: [{ $eq: ['$is_synced_with_zoho', false] }, 1, 0] }
          }
        }
      }
    ]);

    // Get subscription sources breakdown
    const sourceStats = await this.newsletterModel.aggregate([
      { $match: { is_deleted: false, is_active: true } },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get interests breakdown
    const interestStats = await this.newsletterModel.aggregate([
      { $match: { is_deleted: false, is_active: true } },
      { $unwind: '$interests' },
      {
        $group: {
          _id: '$interests',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return {
      ...(stats[0] || {
        total_subscribers: 0,
        active_subscribers: 0,
        inactive_subscribers: 0,
        synced_with_zoho: 0,
        not_synced_with_zoho: 0
      }),
      sources: sourceStats,
      interests: interestStats
    };
  }

  async syncWithZoho(): Promise<{ message: string; synced: number; errors: string[] }> {
    try {
      // Check if Zoho is properly configured
      await this.zohoOAuthService.getValidAccessToken();
    } catch (error) {
      throw new BadRequestException(
        'Zoho integration not configured. Please complete OAuth authorization first.'
      );
    }

    // Get unsynced subscribers
    const unsyncedSubscribers = await this.newsletterModel.find({
      is_active: true,
      is_synced_with_zoho: false,
      is_deleted: false
    });

    let synced = 0;
    const errors: string[] = [];

    for (const subscriber of unsyncedSubscribers) {
      try {
        // Create contact in Zoho using the OAuth service
        const zohoContactId = await this.zohoOAuthService.createZohoContact({
          email: subscriber.email,
          name: subscriber.name,
          phone: subscriber.phone,
          interests: subscriber.interests
        });
        
        // Update subscriber with Zoho contact ID
        subscriber.is_synced_with_zoho = true;
        subscriber.zoho_contact_id = zohoContactId;
        await subscriber.save();
        synced++;
      } catch (error) {
        const errorMsg = `Failed to sync ${subscriber.email}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      message: `Successfully synced ${synced} out of ${unsyncedSubscribers.length} subscribers with Zoho`,
      synced,
      errors
    };
  }

  async sendCampaign(campaignData: {
    subject: string;
    content: string;
    interests?: string[];
    isActive?: boolean;
    useZoho?: boolean;  // Optional: use Zoho for sending
  }): Promise<{ message: string; sent: number ; errors?: string[] }> {
    const query: any = { is_deleted: false };
    
    if (campaignData.isActive !== undefined) {
      query.is_active = campaignData.isActive;
    } else {
      query.is_active = true; // Default to active subscribers
    }
    
    if (campaignData.interests && campaignData.interests.length > 0) {
      query.interests = { $in: campaignData.interests };
    }

    const subscribers = await this.newsletterModel.find(query);

    
    if (campaignData.useZoho) {
      // Send via Zoho Campaigns
      try {
        const recipientEmails = subscribers.map(s => s.email);
        const campaignId = await this.zohoOAuthService.sendZohoCampaign({
          subject: campaignData.subject,
          content: campaignData.content,
          recipientEmails
        });

        // Update all subscribers with last email sent date
        await this.newsletterModel.updateMany(
          { email: { $in: recipientEmails } },
          { last_email_sent: new Date() }
        );

        return {
          message: `Campaign sent via Zoho to ${subscribers.length} subscribers. Campaign ID: ${campaignId}`,
          sent: subscribers.length
        };
      } catch (error) {
        throw new BadRequestException(`Failed to send campaign via Zoho: ${error.message}`);
      }
    } else {
      // Existing email sending logic (keep unchanged)
      let sent = 0;
      const errors: string[] = [];

      for (const subscriber of subscribers) {
        try {
          // Here you would implement actual email sending logic
          // await this.emailService.send({
          //   to: subscriber.email,
          //   subject: campaignData.subject,
          //   content: campaignData.content
          // });

          // Update email statistics
          subscriber.last_email_sent = new Date();
          await subscriber.save();
          sent++;
        } catch (error) {
          const errorMsg = `Failed to send email to ${subscriber.email}: ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return {
        message: `Campaign sent to ${sent} subscribers`,
        sent,
        errors: errors.length > 0 ? errors : undefined
      };
    }
  }
  
  // New method to check Zoho integration status
  async getZohoIntegrationStatus(): Promise<{
    isConfigured: boolean;
    hasValidToken: boolean;
    message: string;
  }> {
    try {
      await this.zohoOAuthService.getValidAccessToken();
      return {
        isConfigured: true,
        hasValidToken: true,
        message: 'Zoho integration is active and ready'
      };
    } catch (error) {
      return {
        isConfigured: false,
        hasValidToken: false,
        message: error.message
      };
    }
  }

  // Helper method to track email opens (you can call this from email tracking pixel)
  async trackEmailOpen(email: string): Promise<void> {
    await this.newsletterModel.updateOne(
      { email, is_active: true },
      { $inc: { email_open_count: 1 } }
    );
  }

  // Helper method to track email clicks
  async trackEmailClick(email: string): Promise<void> {
    await this.newsletterModel.updateOne(
      { email, is_active: true },
      { $inc: { email_click_count: 1 } }
    );
  }
}