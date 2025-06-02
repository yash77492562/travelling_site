import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from '../../schemas/booking.schema';
import { TourPackage } from '../../schemas/tour-package.schema';
import { CreateBookingDto } from './create-booking.dto';
import { UpdateBookingDto } from './update-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(TourPackage.name) private tourPackageModel: Model<TourPackage>,
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    // Verify tour package exists and is active
    const tourPackage = await this.tourPackageModel.findById(createBookingDto.tour_package_id);
    if (!tourPackage || !tourPackage.is_active) {
      throw new NotFoundException('Tour package not found or inactive');
    }

    // Check availability
    if (tourPackage.max_participants > 0 && 
        tourPackage.current_bookings + createBookingDto.participant_count > tourPackage.max_participants) {
      throw new BadRequestException('Not enough slots available');
    }

    // Generate unique booking reference
    const bookingCount = await this.bookingModel.countDocuments();
    const bookingReference = `PH-${new Date().getFullYear()}-${String(bookingCount + 1).padStart(3, '0')}`;

    const booking = new this.bookingModel({
      ...createBookingDto,
      booking_reference: bookingReference,
    });

    const savedBooking = await booking.save();

    // Update tour package booking count
    await this.tourPackageModel.findByIdAndUpdate(
      createBookingDto.tour_package_id,
      { $inc: { current_bookings: createBookingDto.participant_count } }
    );

    return savedBooking.populate(['user_id', 'tour_package_id']);
  }

  async findAll(filters?: any): Promise<Booking[]> {
    const query = { is_deleted: false };
    
    if (filters?.booking_status) query['booking_status'] = filters.booking_status;
    if (filters?.payment_status) query['payment_status'] = filters.payment_status;
    if (filters?.user_id) query['user_id'] = filters.user_id;
    if (filters?.tour_package_id) query['tour_package_id'] = filters.tour_package_id;
    
    if (filters?.travel_date_from || filters?.travel_date_to) {
      query['travel_date'] = {};
      if (filters.travel_date_from) query['travel_date']['$gte'] = new Date(filters.travel_date_from);
      if (filters.travel_date_to) query['travel_date']['$lte'] = new Date(filters.travel_date_to);
    }

    return this.bookingModel
      .find(query)
      .populate('user_id', 'name email phone')
      .populate('tour_package_id', 'title location category price duration')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingModel
      .findOne({ _id: id, is_deleted: false })
      .populate('user_id', 'name email phone')
      .populate('tour_package_id')
      .exec();
    
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    
    return booking;
  }

  async findByUser(userId: string): Promise<Booking[]> {
    return this.bookingModel
      .find({ user_id: userId, is_deleted: false })
      .populate('tour_package_id', 'title location category price duration images')
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(id: string, updateBookingDto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.bookingModel.findOne({ _id: id, is_deleted: false });
    
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Handle participant count changes
    if (updateBookingDto.participant_count && updateBookingDto.participant_count !== booking.participant_count) {
      const difference = updateBookingDto.participant_count - booking.participant_count;
      
      const tourPackage = await this.tourPackageModel.findById(booking.tour_package_id);
      if (!tourPackage) {
        throw new NotFoundException('Tour package not found');
      }

      if (tourPackage.max_participants > 0 && 
          tourPackage.current_bookings + difference > tourPackage.max_participants) {
        throw new BadRequestException('Not enough slots available');
      }

      await this.tourPackageModel.findByIdAndUpdate(
        booking.tour_package_id,
        { $inc: { current_bookings: difference } }
      );
    }

    Object.assign(booking, updateBookingDto);
    const updatedBooking = await booking.save();
    
    return updatedBooking.populate(['user_id', 'tour_package_id']);
  }

  async updatePaymentStatus(
    bookingId: string, 
    paymentData: {
      payment_status: string;
      payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
      payment_date?: Date;
    }
  ): Promise<Booking> {
    const booking = await this.bookingModel.findById(bookingId);
    
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    Object.assign(booking, paymentData);
    
    if (paymentData.payment_status === 'paid') {
      booking.booking_status = 'confirmed';
      booking.payment_date = new Date();
    }

    return booking.save();
  }

  async cancel(id: string, userId: string, reason?: string): Promise<Booking> {
    const booking = await this.bookingModel.findOne({ _id: id, is_deleted: false });
    
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.booking_status === 'cancelled') {
      throw new BadRequestException('Booking already cancelled');
    }

    booking.booking_status = 'cancelled';
    booking.cancellation_reason = reason || '';
    booking.cancelled_at = new Date();
    booking.cancelled_by = userId as any;

    // Update tour package booking count
    await this.tourPackageModel.findByIdAndUpdate(
      booking.tour_package_id,
      { $inc: { current_bookings: -booking.participant_count } }
    );

    return booking.save();
  }

  async remove(id: string): Promise<void> {
    const booking = await this.bookingModel.findById(id);
    
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    booking.is_deleted = true;
    booking.is_deleted_date = new Date();
    
    // Update tour package booking count if booking was active
    if (booking.booking_status !== 'cancelled') {
      await this.tourPackageModel.findByIdAndUpdate(
        booking.tour_package_id,
        { $inc: { current_bookings: -booking.participant_count } }
      );
    }

    await booking.save();
  }

  async getBookingStats(): Promise<any> {
    const stats = await this.bookingModel.aggregate([
      { $match: { is_deleted: false } },
      {
        $group: {
          _id: null,
          total_bookings: { $sum: 1 },
          confirmed_bookings: {
            $sum: { $cond: [{ $eq: ['$booking_status', 'confirmed'] }, 1, 0] }
          },
          pending_bookings: {
            $sum: { $cond: [{ $eq: ['$booking_status', 'pending'] }, 1, 0] }
          },
          cancelled_bookings: {
            $sum: { $cond: [{ $eq: ['$booking_status', 'cancelled'] }, 1, 0] }
          },
          total_revenue: {
            $sum: { $cond: [{ $eq: ['$payment_status', 'paid'] }, '$total_amount', 0] }
          },
          pending_payments: {
            $sum: { $cond: [{ $eq: ['$payment_status', 'pending'] }, '$total_amount', 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      total_bookings: 0,
      confirmed_bookings: 0,
      pending_bookings: 0,
      cancelled_bookings: 0,
      total_revenue: 0,
      pending_payments: 0
    };
  }
}