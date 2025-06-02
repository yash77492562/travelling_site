// auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpException,
  Param,
  Delete,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { 
  LoginRateLimit, 
  RegisterRateLimit, 
  ForgotPasswordRateLimit 
} from '../common/decorators/rate-limit.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { ForgotPasswordDto } from './forgot-password.dto';
import { RefreshTokenDto } from './auth.refresh-token.dto';
import { CreateUserDto } from '../AdminModule/admin.dto.create-user';
import { VerifyEmailDto } from './auth.verify-email.dto';
import { StatusCode, StatusMessage } from '../../constants/HttpConstant';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
@UseGuards(RateLimitGuard) // Apply rate limiting globally for all auth routes

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @RegisterRateLimit() // Apply rate limiting for registration
  async register(@Body() registerDto: RegisterDto) {
    try {
        console.log(registerDto, 'registerDto');
      const result = await this.authService.register(registerDto);
      return {
        statusCode: StatusCode.HTTP_CREATED,
        message: 'User registered successfully. Please verify your email.',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || StatusMessage.HTTP_BAD_REQUEST,
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Post('login')
  @LoginRateLimit() // Apply rate limiting for login
  async login(@Body() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Login successful',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_UNAUTHORIZED,
          message: error.message || 'Invalid credentials',
        },
        error.status || StatusCode.HTTP_UNAUTHORIZED,
      );
    }
  }

  // ✅ FIRST ADMIN SETUP - No authentication required, only works if no admins exist
  @Post('admin/setup')
  @RegisterRateLimit()
  async setupFirstAdmin(@Body() adminRegisterDto: CreateUserDto, @Request() req) {
    try {
      // Check if any admin already exists
      const existingAdmin = await this.authService.checkIfAnyAdminExists();
      if (existingAdmin) {
        throw new HttpException(
          {
            statusCode: StatusCode.HTTP_FORBIDDEN,
            message: 'Admin setup already completed. Use regular admin registration with authentication.',
          },
          StatusCode.HTTP_FORBIDDEN,
        );
      }

      const context = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceDetails: req.body.deviceDetails
      };
      
      const result = await this.authService.registerAdmin(
        adminRegisterDto, 
        undefined, // No creator for first admin
        context
      );
      
      return {
        statusCode: StatusCode.HTTP_CREATED,
        message: 'First admin created successfully with tokens. This setup endpoint is now disabled.',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || StatusMessage.HTTP_BAD_REQUEST,
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  // ✅ SUBSEQUENT ADMIN CREATION - Requires authentication from existing admin
  @Post('admin/register')
  @RegisterRateLimit() // Apply rate limiting for admin registration
  @UseGuards(JwtAuthGuard) // Admin must be logged in to create other admins
  async registerAdmin(@Body() adminRegisterDto: CreateUserDto, @Request() req) {
    try {
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceDetails: req.body.deviceDetails // Optional device details from client
      };
      console.log('context', context);
      
      const result = await this.authService.registerAdmin(
        adminRegisterDto, 
        req.user.sub, // Creator ID from authenticated admin
        context
      );
      
      return {
        statusCode: StatusCode.HTTP_CREATED,
        message: 'Admin registered successfully with tokens',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || StatusMessage.HTTP_BAD_REQUEST,
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Post('admin/login')
  @LoginRateLimit() // Apply rate limiting for admin login
  async loginAdmin(@Body() loginDto: LoginDto, @Request() req) {
    try {
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceDetails: req.body.deviceDetails // Optional device details from client
      };
      
      const result = await this.authService.loginAdmin(loginDto, context);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Admin login successful',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_UNAUTHORIZED,
          message: error.message || 'Invalid admin credentials',
        },
        error.status || StatusCode.HTTP_UNAUTHORIZED,
      );
    }
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getUserDevices(@Request() req) {
    try {
      const devices = await this.authService.getUserDevices(req.user.sub);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Devices retrieved successfully',
        data: devices,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve devices',
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  async revokeDevice(@Request() req, @Param('deviceId') deviceId: string) {
    try {
      const result = await this.authService.revokeDevice(req.user.sub, deviceId);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Device revoked successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to revoke device',
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('devices')
  @UseGuards(JwtAuthGuard)
  async revokeAllDevices(@Request() req) {
    try {
      const result = await this.authService.revokeAllDevices(req.user.sub);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'All devices revoked successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to revoke all devices',
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }
  
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    try {
      const result = await this.authService.logout(req.user.sub);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Logged out successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Logout failed',
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Request() req) {
    try {
      // For refresh token, we need to extract userId differently since token might be expired
      // The client should send userId along with refresh token
      const result = await this.authService.refreshToken(
        refreshTokenDto.userId, 
        refreshTokenDto.refreshToken,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          deviceDetails: req.body.deviceDetails
        }
      );
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Token refreshed successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_UNAUTHORIZED,
          message: error.message || 'Token refresh failed',
        },
        error.status || StatusCode.HTTP_UNAUTHORIZED,
      );
    }
  }

  @Post('forgot-password')
  @ForgotPasswordRateLimit() // Apply rate limiting for forgot password
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    try {
      const result = await this.authService.forgotPassword(forgotPasswordDto);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'If the email exists, a reset link has been sent',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to send reset email',
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    try {
      const result = await this.authService.verifyEmail(verifyEmailDto.verificationToken);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Email verified successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || 'Email verification failed',
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    try {
      const user = await this.authService.validateUser(req.user.sub);
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Profile retrieved successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_UNAUTHORIZED,
          message: error.message || 'Failed to get profile',
        },
        error.status || StatusCode.HTTP_UNAUTHORIZED,
      );
    }
  }
}