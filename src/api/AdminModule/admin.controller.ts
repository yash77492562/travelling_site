import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpException,
  UseGuards,
  Req,
  Put,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { StatusCode, StatusMessage } from '../../constants/HttpConstant';
import { MessageConstant } from '../../constants/MessageConstant';
import { JwtAuthGuard } from '../AuthModule/jwt-auth.guard';
import { RolesGuard } from './admin.roles-guards';
import { Roles } from './admin.roles-decorators';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: any;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1) // Only Super Admin (0) and Admin (1) can access
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  @Get('users')
  async getAllUsers(
    @Req() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: boolean,
    @Query('role') role?: number,
    @Query('includeDeleted') includeDeleted?: boolean,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    try {
      const result = await this.adminService.getAllUsers({
        page: Number(page),
        limit: Number(limit),
        status: status !== undefined ? Boolean(status) : undefined,
        role: role ? Number(role) : undefined,
        includeDeleted: Boolean(includeDeleted),
        search,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc',
      });

      // Log admin action
      await this.adminService.logAdminAction({
        admin_id: req.user['userId'],
        action: 'VIEW_USERS',
        entity_type: 'user',
        description: `Admin viewed users list with filters`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        module: 'AdminController',
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: MessageConstant.FATCH_SUCCESS,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || StatusMessage.HTTP_INTERNAL_SERVER_ERROR,
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string, @Req() req: RequestWithUser) {
    try {
      const user = await this.adminService.getUserById(id);
      
      await this.adminService.logAdminAction({
        admin_id: req.user['userId'],
        action: 'VIEW_USER_DETAILS',
        entity_type: 'user',
        entity_id: id,
        description: `Admin viewed user details for ${user.email}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        module: 'AdminController',
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: MessageConstant.FATCH_SUCCESS,
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || StatusMessage.HTTP_INTERNAL_SERVER_ERROR,
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('users/:id/block')
  async blockUser(@Param('id') id: string, @Req() req: RequestWithUser) {
    try {
      const user = await this.adminService.blockUser(id);
      
      await this.adminService.logAdminAction({
        admin_id: req.user['userId'],
        action: 'BLOCK_USER',
        entity_type: 'user',
        entity_id: id,
        description: `Admin blocked user: ${user.email}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        old_values: { status: true },
        new_values: { status: false, blocked: true },
        severity: 'warning',
        module: 'AdminController',
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'User blocked successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || 'Failed to block user',
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Patch('users/:id/unblock')
  async unblockUser(@Param('id') id: string, @Req() req: RequestWithUser) {
    try {
      const user = await this.adminService.unblockUser(id);
      
      await this.adminService.logAdminAction({
        admin_id: req.user['userId'],
        action: 'UNBLOCK_USER',
        entity_type: 'user',
        entity_id: id,
        description: `Admin unblocked user: ${user.email}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        old_values: { status: false, blocked: true },
        new_values: { status: true, blocked: false },
        module: 'AdminController',
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'User unblocked successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || 'Failed to unblock user',
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  

  // ===== ANALYTICS & REPORTING =====

  @Get('analytics/users')
  async viewUserAnalytics(@Req() req: RequestWithUser) {
    try {
      const analytics = await this.adminService.getUserAnalytics();
      
      await this.adminService.logAdminAction({
        admin_id: req.user['userId'],
        action: 'VIEW_USER_ANALYTICS',
        entity_type: 'analytics',
        description: 'Admin viewed user analytics dashboard',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        module: 'AdminController',
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'User analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve user analytics',
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/dashboard')
  async getDashboardAnalytics(@Req() req: RequestWithUser) {
    try {
      const analytics = await this.adminService.getDashboardAnalytics();
      
      await this.adminService.logAdminAction({
        admin_id: req.user['userId'],
        action: 'VIEW_DASHBOARD_ANALYTICS',
        entity_type: 'analytics',
        description: 'Admin viewed dashboard analytics',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        module: 'AdminController',
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Dashboard analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve dashboard analytics',
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===== SYSTEM SETTINGS =====

  @Get('settings')
  async getSystemSettings(@Req() req: RequestWithUser) {
    try {
      const settings = await this.adminService.getSystemSettings();
      
      await this.adminService.logAdminAction({
        admin_id: req.user['userId'],
        action: 'VIEW_SYSTEM_SETTINGS',
        entity_type: 'settings',
        description: 'Admin viewed system settings',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        module: 'AdminController',
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'System settings retrieved successfully',
        data: settings,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve system settings',
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  // ===== ADMIN LOGS =====

  @Get('logs')
  async getAdminLogs(
    @Req() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('action') action?: string,
    @Query('entity_type') entity_type?: string,
    @Query('severity') severity?: string,
    @Query('admin_id') admin_id?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
  ) {
    try {
      const result = await this.adminService.getAdminLogs({
        page: Number(page),
        limit: Number(limit),
        action,
        entity_type,
        severity,
        admin_id,
        date_from: date_from ? new Date(date_from) : undefined,
        date_to: date_to ? new Date(date_to) : undefined,
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Admin logs retrieved successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve admin logs',
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }


  // ===== EXPORT DATA =====

  @Get('export/users')
  async exportUsers(
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Query('includeDeleted') includeDeleted: boolean = false,
    @Req() req: RequestWithUser,
  ) {
    try {
      const result = await this.adminService.exportUsers(format, includeDeleted);
      
      await this.adminService.logAdminAction({
        admin_id: req.user['userId'],
        action: 'EXPORT_USERS',
        entity_type: 'user',
        description: `Admin exported users data in ${format} format`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        new_values: { format, includeDeleted },
        module: 'AdminController',
      });

      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'Users data exported successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to export users data',
        },
        StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }
}