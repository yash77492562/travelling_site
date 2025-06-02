// newsletter.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { ZohoAuthController } from './zoho-OAuth/zoho-auth.controller';
import { ConfigController } from './zoho-OAuth/config.controller'; // Add this import
import { ZohoOAuthService } from './zoho-OAuth/zoho-oauth.service';
import { Newsletter, NewsletterSchema } from '../../schemas/newsletter.schema';
import { Config, ConfigSchema } from '../../schemas/config.schema'; // Add this import

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Newsletter.name, schema: NewsletterSchema },
      { name: Config.name, schema: ConfigSchema } // Add Config model
    ]),
    ConfigModule // Add this to access environment variables
  ],
  controllers: [
    NewsletterController,
    ZohoAuthController, // Add the Zoho auth controller
    ConfigController // Add the config controller for admin management
  ],
  providers: [
    NewsletterService,
    ZohoOAuthService // Add the Zoho OAuth service
  ],
  exports: [NewsletterService, ZohoOAuthService]
})
export class NewsletterModule {}