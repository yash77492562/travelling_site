
// user/user.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Request,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { UserService } from './users.service';
import { ChangePasswordDto } from './user.change-password.dto';
import { ResetPasswordDto } from './user.reset-password.dto';
import { UpdateProfileDto } from './update-profile.dto';
import { JwtAuthGuard } from '../AuthModule/jwt-auth.guard';
import { StatusCode } from '../../constants/HttpConstant';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    try {
      console.log(req.user, 'req.user');
      const user = await this.userService.getProfile(req.user.sub);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Profile retrieved successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to get profile',
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    try {
      const user = await this.userService.updateProfile(req.user.sub, updateProfileDto);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Profile updated successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || 'Profile update failed',
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    try {
      const result = await this.userService.changePassword(req.user.sub, changePasswordDto);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Password changed successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || 'Password change failed',
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    try {
      const result = await this.userService.resetPassword(resetPasswordDto);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Password reset successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || 'Password reset failed',
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Request() req) {
    try {
      const result = await this.userService.deleteAccount(req.user.sub);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Account deleted successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Account deletion failed',
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }
}
