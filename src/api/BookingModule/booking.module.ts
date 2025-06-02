import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from '../../schemas/booking.schema';
import { TourPackagesModule } from '../TourPackagesModule/tourPackage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema }
    ]),
    TourPackagesModule // Import to access TourPackage model in BookingsService
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService, MongooseModule]
})
export class BookingsModule {}