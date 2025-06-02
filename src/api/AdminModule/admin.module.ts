// admin/admin.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../../schemas/user.schema';
import { AdminLogs, AdminLogsSchema } from '../../schemas/admin-logs.schema';
import { Booking, BookingSchema } from '../../schemas/booking.schema';
import { SystemSettings, SystemSettingsSchema } from '../../schemas/system-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AdminLogs.name, schema: AdminLogsSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: SystemSettings.name, schema: SystemSettingsSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}