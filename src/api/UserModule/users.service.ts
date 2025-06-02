
// user/user.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { User } from '../../schemas/user.schema';
import { ChangePasswordDto } from './user.change-password.dto';
import { ResetPasswordDto } from './user.reset-password.dto';
import { UpdateProfileDto } from './update-profile.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userModel.findOne({
      _id: userId,
      is_deleted: false
    }).select('-password -refreshToken -emailVerificationToken -passwordResetToken');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findOne({
      _id: userId,
      is_deleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { ...updateProfileDto },
      { new: true }
    ).select('-password -refreshToken -emailVerificationToken -passwordResetToken');

    return updatedUser;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this.userModel.findOne({
      _id: userId,
      is_deleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await argon2.verify(user.password, oldPassword);
    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword);

    // Update password and clear all refresh tokens
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
      refreshToken: null
    });

    return { message: 'Password changed successfully' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.userModel.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
      is_deleted: false
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword);

    // Update password and clear reset token
    await this.userModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshToken: null // Force re-login
    });

    return { message: 'Password reset successfully' };
  }

  async deleteAccount(userId: string) {
    const user = await this.userModel.findOne({
      _id: userId,
      is_deleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete
    await this.userModel.findByIdAndUpdate(userId, {
      is_deleted: true,
      is_deleted_date: new Date(),
      refreshToken: null,
      status: false
    });

    return { message: 'Account deleted successfully' };
  }
}