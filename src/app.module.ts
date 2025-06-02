import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonConfig } from './config/CommonConfig';
import { CommonModule } from './api/common/commonModule';
import {RateLimitGuard} from './api/common/guards/rate-limit.guard'
// Import Modules
import { UserModule } from './api/UserModule/user.module';
import { AuthModule } from './api/AuthModule/auth.module';
import { TourPackagesModule } from './api/TourPackagesModule/tourPackage.module';
import { BookingsModule } from './api/BookingModule/booking.module';
import { AdminModule } from './api/AdminModule/admin.module';
import { NewsletterModule } from './api/NewsletterModule/newsletter.module';
// Import Schemas
import { User, UserSchema } from './schemas/user.schema';
import { TourPackage, TourPackageSchema } from './schemas/tour-package.schema';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { AdminLogs, AdminLogsSchema } from './schemas/admin-logs.schema';
import { Newsletter, NewsletterSchema } from './schemas/newsletter.schema';
import { SiteSettings, SiteSettingsSchema } from './schemas/site-settings.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // MongoDB Connection
    MongooseModule.forRoot(CommonConfig.MONGODB_URI),
    
    // Register all schemas
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: TourPackage.name, schema: TourPackageSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: AdminLogs.name, schema: AdminLogsSchema },
      { name: Newsletter.name, schema: NewsletterSchema },
      { name: SiteSettings.name, schema: SiteSettingsSchema },
    ]),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }]),
    
    // Import feature modules
    CommonModule,
    UserModule,
    AuthModule,
    TourPackagesModule,
    BookingsModule,
    AdminModule,
    // PaymentsModule,
    NewsletterModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Register RateLimitGuard globally using APP_GUARD token
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}