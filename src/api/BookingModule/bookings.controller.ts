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
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './create-booking.dto';
import { RolesGuard } from '../AdminModule/admin.roles-guards';
import { UpdateBookingDto } from './update-booking.dto';
import { JwtAuthGuard } from '../AuthModule/jwt-auth.guard';
import { Roles } from '../AdminModule/admin.roles-decorators'; // Use the correct decorator

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard) // Add your auth guard
  async create(@Body() createBookingDto: CreateBookingDto, @Request() req) {
    // Add user_id from authenticated user
    createBookingDto.user_id = req.user?.userId || req.user?.sub;
    return this.bookingsService.create(createBookingDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard) // Add your auth guard
  async findAll(@Query() query: any) {
    return this.bookingsService.findAll(query);
  }

  @Get('stats')
    @UseGuards(JwtAuthGuard, RolesGuard) // Add admin guard
  @Roles(1)
  async getStats() {
    return this.bookingsService.getBookingStats();
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard) // Add your auth guard
  async findByUser(@Param('userId') userId: string) {
    return this.bookingsService.findByUser(userId);
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard) // Add your auth guard
  async getMyBookings(@Request() req) {
  return this.bookingsService.findByUser(req.user.userId || req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard) // Add your auth guard
  async findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard) // Add your auth guard
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Patch(':id/payment-status')
  @UseGuards(JwtAuthGuard) // Add your auth guard
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() paymentData: {
      payment_status: string;
      payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
    },
  ) {
    return this.bookingsService.updatePaymentStatus(id, paymentData);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard) // Add your auth guard
  async cancel(
    @Param('id') id: string,
    @Body() cancelData: { reason?: string },
    @Request() req,
  ) {
  return this.bookingsService.cancel(id, req.user.userId || req.user.sub, cancelData.reason);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard,RolesGuard) // Add admin guard
  @Roles(1) // Admin role
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}