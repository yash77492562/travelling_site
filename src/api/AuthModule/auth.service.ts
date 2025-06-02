// auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { User } from '../../schemas/user.schema';
import { AdminLogs } from '../../schemas/admin-logs.schema';
import { DeviceInfo } from '../../schemas/device-info.schema';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { CreateUserDto } from '../AdminModule/admin.dto.create-user';
import { ForgotPasswordDto } from './forgot-password.dto';

interface DeviceDetails {
  deviceId?: string;
  deviceType?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };
}

interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
  deviceDetails?: DeviceDetails;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(AdminLogs.name) private adminLogsModel: Model<AdminLogs>,
    @InjectModel(DeviceInfo.name) private deviceInfoModel: Model<DeviceInfo>,
    private jwtService: JwtService,
  ) {}

  // ✅ CHECK IF ANY ADMIN EXISTS (for first admin setup)
  async checkIfAnyAdminExists(): Promise<boolean> {
    const adminCount = await this.userModel.countDocuments({
      role: 1, // Admin role
      is_deleted: false
    });
    
    return adminCount > 0;
  }

  // ✅ USER AUTHENTICATION
  async register(registerDto: RegisterDto, context?: LoginContext): Promise<any> {
    console.log('Registering user:', registerDto.email);
    
    // Check if user already exists
    const existingUser = await this.userModel.findOne({ 
      email: registerDto.email.toLowerCase(),
      is_deleted: false 
    });
    
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await argon2.hash(registerDto.password);
    
    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const userData = {
      ...registerDto,
      email: registerDto.email.toLowerCase(),
      password: hashedPassword,
      is_deleted: false,
      status: true,
      role: 2, // Default user role (2 = User)
      isEmailVerified: false,
      emailVerificationToken,
    };
    
    const createdUser = new this.userModel(userData);
    const savedUser = await createdUser.save();
    
    // Generate tokens
    const tokens = await this.generateTokens(savedUser.id, savedUser.email, savedUser.role);
    
    // Save device info and refresh token
    await this.saveDeviceInfo(savedUser.id, tokens.refreshToken, context);

    // Remove sensitive data from response
    const userObject = savedUser.toObject();
    const { password, refreshToken, emailVerificationToken: _, ...safeUserObject } = userObject;
    
    console.log('User registered successfully:', userObject.email);
    
    return {
      user: safeUserObject,
      tokens,
      emailVerificationToken: emailVerificationToken // For sending verification email
    };
  }

  async login(loginDto: LoginDto, context?: LoginContext): Promise<any> {
    const { email } = loginDto;
    
    // Find user with password
    const user = await this.userModel.findOne({ 
      email: email.toLowerCase(),
      is_deleted: false,
      role: 2 // Only regular users
    }).exec();
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.status) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check if user is blocked
    if (user.blocked) {
      throw new UnauthorizedException('Account is blocked. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.password, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    
    // Save device info and update user
    await this.saveDeviceInfo(user.id, tokens.refreshToken, context);
    await this.userModel.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date()
    });

    // Remove sensitive data from response
    const userObject = user.toObject();
    const { password, refreshToken, emailVerificationToken, ...safeUserObject } = userObject;
    
    console.log('User logged in successfully:', userObject.email);
    
    return {
      user: safeUserObject,
      tokens
    };
  }

  // ✅ ADMIN AUTHENTICATION
  async registerAdmin(adminRegisterDto: CreateUserDto, creatorId?: string, context?: LoginContext): Promise<any> {
    console.log('Registering admin:', adminRegisterDto.email);
    
    // Only existing Admin can create new admin accounts (optional - remove if not needed)
    if (creatorId) {
      const creator = await this.userModel.findById(creatorId);
      if (!creator || creator.role !== 1) {
        throw new ForbiddenException('Only Admin can create admin accounts');
      }
    }

    // Check if admin already exists
    const existingUser = await this.userModel.findOne({ 
      email: adminRegisterDto.email.toLowerCase(),
      is_deleted: false 
    });
    
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await argon2.hash(adminRegisterDto.password);

    const adminData = {
      ...adminRegisterDto,
      email: adminRegisterDto.email.toLowerCase(),
      password: hashedPassword,
      is_deleted: false,
      status: true,
      role: 1, // Admin role
      isEmailVerified: true, // Admins are pre-verified
      emailVerificationToken: null,
    };
    
    const createdAdmin = new this.userModel(adminData);
    const savedAdmin = await createdAdmin.save();
    
    // Generate tokens IMMEDIATELY upon registration
    const tokens = await this.generateTokens(savedAdmin.id, savedAdmin.email, savedAdmin.role);
    
    // Save device info
    await this.saveDeviceInfo(savedAdmin.id, tokens.refreshToken, context);

    // Log admin creation
    if (creatorId) {
      await this.logAdminAction({
        admin_id: creatorId,
        action: 'CREATE_ADMIN',
        entity_type: 'admin',
        entity_id: savedAdmin.id,
        description: `Admin created new admin: ${savedAdmin.email}`,
        ip_address: context?.ipAddress,
        user_agent: context?.userAgent,
        new_values: { email: savedAdmin.email, role: savedAdmin.role },
        severity: 'warning',
        module: 'AuthService',
      });
    } else {
      // Log first admin setup
      await this.logAdminAction({
        admin_id: savedAdmin.id,
        action: 'FIRST_ADMIN_SETUP',
        entity_type: 'admin',
        entity_id: savedAdmin.id,
        description: `First admin account created: ${savedAdmin.email}`,
        ip_address: context?.ipAddress,
        user_agent: context?.userAgent,
        new_values: { email: savedAdmin.email, role: savedAdmin.role },
        severity: 'critical',
        module: 'AuthService',
      });
    }

    // Remove sensitive data from response
    const adminObject = savedAdmin.toObject();
    const { password, refreshToken, ...safeAdminObject } = adminObject;
    
    console.log('Admin registered successfully with tokens:', adminObject.email);
    
    return {
      user: safeAdminObject,
      tokens // ✅ Tokens provided immediately upon admin creation
    };
  }

  async loginAdmin(loginDto: LoginDto, context?: LoginContext): Promise<any> {
    const { email } = loginDto;
    
    // Find admin user
    const user = await this.userModel.findOne({ 
      email: email.toLowerCase(),
      is_deleted: false,
      role: 1 // Only Admin
    }).exec();
    
    if (!user) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Check if admin is active
    if (!user.status) {
      throw new UnauthorizedException('Admin account is deactivated');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.password, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    
    // Save device info and update admin
    await this.saveDeviceInfo(user.id, tokens.refreshToken, context);
    await this.userModel.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date()
    });

    // Log admin login
    await this.logAdminAction({
      admin_id: user.id,
      action: 'ADMIN_LOGIN',
      entity_type: 'admin',
      entity_id: user.id,
      description: `Admin logged in: ${user.email}`,
      ip_address: context?.ipAddress,
      user_agent: context?.userAgent,
      module: 'AuthService',
    });

    // Remove sensitive data from response
    const userObject = user.toObject();
    const { password, refreshToken, emailVerificationToken, ...safeUserObject } = userObject;
    
    console.log('Admin logged in successfully:', userObject.email);
    
    return {
      user: safeUserObject,
      tokens
    };
  }

  // ✅ COMMON AUTHENTICATION METHODS
  async logout(userId: string, context?: LoginContext): Promise<any> {
    const user = await this.userModel.findById(userId);
    
    // Clear refresh token and device info
    await Promise.all([
      this.userModel.findByIdAndUpdate(userId, { refreshToken: null }),
      this.deviceInfoModel.deleteMany({ userId, isActive: true })
    ]);

    // Log admin logout if it's an admin
    if (user && user.role === 1) {
      await this.logAdminAction({
        admin_id: userId,
        action: 'ADMIN_LOGOUT',
        entity_type: 'admin',
        entity_id: userId,
        description: `Admin logged out: ${user.email}`,
        ip_address: context?.ipAddress,
        user_agent: context?.userAgent,
        module: 'AuthService',
      });
    }

    return { message: 'Logged out successfully' };
  }

  async refreshToken(userId: string, refreshToken: string, context?: LoginContext): Promise<any> {
    const user = await this.userModel.findOne({
      _id: userId,
      is_deleted: false
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Verify refresh token
    const isTokenValid = await argon2.verify(user.refreshToken, refreshToken);
    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    
    // Update device info with new refresh token
    await this.saveDeviceInfo(user.id, tokens.refreshToken, context);

    return tokens;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<any> {
    const { email } = forgotPasswordDto;
    
    const user = await this.userModel.findOne({ 
      email: email.toLowerCase(),
      is_deleted: false 
    });

    if (!user) {
      // Don't reveal if email exists or not
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.userModel.findByIdAndUpdate(user._id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires
    });

    return { 
      message: 'If the email exists, a reset link has been sent',
      resetToken // For sending email (remove in production)
    };
  }

  async verifyEmail(verificationToken: string): Promise<any> {
    const user = await this.userModel.findOne({
      emailVerificationToken: verificationToken,
      is_deleted: false
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    // Mark email as verified
    await this.userModel.findByIdAndUpdate(user._id, {
      isEmailVerified: true,
      emailVerificationToken: null
    });

    return { message: 'Email verified successfully' };
  }
  
  async resetPassword(resetToken: string, newPassword: string): Promise<any> {
    const user = await this.userModel.findOne({
      passwordResetToken: resetToken,
      passwordResetExpires: { $gt: new Date() },
      is_deleted: false
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword);

    // Update user password and clear reset token
    await this.userModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshToken: null // Force re-login
    });

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await argon2.verify(user.password, currentPassword);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await argon2.hash(newPassword);

    // Update password and clear refresh token (force re-login)
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      refreshToken: null
    });

    return { message: 'Password changed successfully' };
  }

  // ✅ DEVICE MANAGEMENT
  private async saveDeviceInfo(userId: string, refreshToken: string, context?: LoginContext): Promise<void> {
    if (!context?.deviceDetails) return;

    const hashedRefreshToken = await argon2.hash(refreshToken);

    // Deactivate previous sessions for this device
    if (context.deviceDetails.deviceId) {
      await this.deviceInfoModel.updateMany(
        { userId, deviceId: context.deviceDetails.deviceId },
        { isActive: false }
      );
    }

    // Save new device info
    const deviceInfo = new this.deviceInfoModel({
      userId,
      deviceId: context.deviceDetails.deviceId,
      deviceType: context.deviceDetails.deviceType,
      browserName: context.deviceDetails.browserName,
      browserVersion: context.deviceDetails.browserVersion,
      osName: context.deviceDetails.osName,
      osVersion: context.deviceDetails.osVersion,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      location: context.deviceDetails.location,
      refreshToken: hashedRefreshToken,
      isActive: true,
      lastUsedAt: new Date()
    });

    await deviceInfo.save();

    // Also update user's refresh token
    await this.userModel.findByIdAndUpdate(userId, {
      refreshToken: hashedRefreshToken
    });
  }

  async getUserDevices(userId: string): Promise<any> {
    const devices = await this.deviceInfoModel
      .find({ userId, isActive: true })
      .select('-refreshToken')
      .sort({ lastUsedAt: -1 });

    return devices;
  }

  async revokeDevice(userId: string, deviceId: string): Promise<any> {
    await this.deviceInfoModel.findOneAndUpdate(
      { userId, deviceId, isActive: true },
      { isActive: false }
    );

    return { message: 'Device revoked successfully' };
  }

  async revokeAllDevices(userId: string): Promise<any> {
    await Promise.all([
      this.deviceInfoModel.updateMany(
        { userId, isActive: true },
        { isActive: false }
      ),
      this.userModel.findByIdAndUpdate(userId, { refreshToken: null })
    ]);

    return { message: 'All devices revoked successfully' };
  }

  // ✅ HELPER METHODS
  private async generateTokens(userId: string, email: string, role: number) {
    const payload = { 
      sub: userId, 
      email, 
      role,
      userId // Add userId for backward compatibility
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }


  async validateUser(userId: string): Promise<User> {
    const user = await this.userModel.findOne({
      _id: userId,
      is_deleted: false,
      status: true
    }).select('-password -refreshToken -emailVerificationToken -passwordResetToken');

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  // ✅ ADMIN LOGGING
  private async logAdminAction(options: {
    admin_id: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    description: string;
    ip_address?: string;
    user_agent?: string;
    old_values?: any;
    new_values?: any;
    severity?: string;
    module: string;
  }): Promise<void> {
    try {
      const log = new this.adminLogsModel({
        admin_id: options.admin_id,
        action: options.action,
        entity_type: options.entity_type,
        entity_id: options.entity_id,
        description: options.description,
        ip_address: options.ip_address,
        user_agent: options.user_agent,
        old_values: options.old_values,
        new_values: options.new_values,
        severity: options.severity || 'info',
        module: options.module,
        is_system_generated: false
      });

      await log.save();
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  }

  // ✅ ROLE-BASED HELPERS (Simplified)
  isAdmin(user: any): boolean {
    return user.role === 1;
  }

  isUser(user: any): boolean {
    return user.role === 2;
  }
}