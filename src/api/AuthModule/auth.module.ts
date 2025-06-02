// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User, UserSchema } from '../../schemas/user.schema';
import { JwtStrategy } from './auth.strategies.jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import {AdminLogs, AdminLogsSchema} from '../../schemas/admin-logs.schema';
import {DeviceInfo, DeviceInfoSchema} from '../../schemas/device-info.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AdminLogs.name, schema: AdminLogsSchema },
      { name: DeviceInfo.name, schema: DeviceInfoSchema }, // Add this line
    ]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
