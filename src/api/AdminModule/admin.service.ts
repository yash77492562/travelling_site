
// admin/admin.service.ts
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../schemas/user.schema';
import { AdminLogs } from '../../schemas/admin-logs.schema';
import { Booking } from '../../schemas/booking.schema';
import { SystemSettings } from '../../schemas/system-setting.schema';
import { CreateUserDto } from './admin.dto.create-user';

interface GetAllUsersOptions {
  page: number;
  limit: number;
  status?: boolean;
  role?: number;
  includeDeleted?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface GetAdminLogsOptions {
  page: number;
  limit: number;
  action?: string;
  entity_type?: string;
  severity?: string;
  admin_id?: string;
  date_from?: Date;
  date_to?: Date;
}

interface LogAdminActionOptions {
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
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(AdminLogs.name) private adminLogsModel: Model<AdminLogs>,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(SystemSettings.name) private systemSettingsModel: Model<SystemSettings>,
  ) {}

  // ===== USER MANAGEMENT =====

  async getAllUsers(options: GetAllUsersOptions) {
    const { page, limit, status, role, includeDeleted = false, search, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter: any = {};
    
    if (!includeDeleted) {
      filter.is_deleted = false;
    }
    
    if (status !== undefined) {
      filter.status = status;
    }
    
    if (role !== undefined) {
      filter.role = role;
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort object
    const sort: any = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort['createdAt'] = -1; // Default sort by creation date descending
    }

    const [userGrowth, total, stats, usersByRole] = await Promise.all([
      this.userModel.aggregate([
        {
          $match: { is_deleted: false }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]),
      this.userModel.countDocuments(filter),
      this.getUserStats(),
      this.userModel.aggregate([
        { $match: { is_deleted: false } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    ]);

    return {
      overview: {
        totalUsers: stats.totalUsers,
        activeUsers: stats.activeUsers,
        inactiveUsers: stats.inactiveUsers,
        blockedUsers: await this.userModel.countDocuments({ blocked: true }),
        deletedUsers: stats.deletedUsers,
        recentRegistrations: userGrowth
      },
      usersByRole: usersByRole.map(item => ({
        role: item._id,
        roleName: this.getRoleName(item._id),
        count: item.count
      })),
      userGrowth: userGrowth.reverse()
    };
  }

  async getDashboardAnalytics() {
    const [
      userStats,
      bookingStats,
      revenueStats,
      recentActivity
    ] = await Promise.all([
      this.getUserStats(),
      this.getBookingStats(),
      this.getRevenueStats(),
      this.getRecentActivity()
    ]);

    return {
      userStats,
      bookingStats,
      revenueStats,
      recentActivity
    };
  }

  private async getUserStats() {
    const [totalUsers, activeUsers, deletedUsers, usersByRole, newThisMonth] = await Promise.all([
      this.userModel.countDocuments({ is_deleted: false }),
      this.userModel.countDocuments({ is_deleted: false, status: true }),
      this.userModel.countDocuments({ is_deleted: true }),
      this.userModel.aggregate([
        { $match: { is_deleted: false } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      this.userModel.countDocuments({
        is_deleted: false,
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      })
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      deletedUsers,
      newThisMonth,
      usersByRole: usersByRole.map(item => ({
        role: item._id,
        roleName: this.getRoleName(item._id),
        count: item.count
      }))
    };
  }

  private async getBookingStats() {
    const [totalBookings, pendingBookings, completedBookings] = await Promise.all([
      this.bookingModel.countDocuments(),
      this.bookingModel.countDocuments({ status: 'pending' }),
      this.bookingModel.countDocuments({ status: 'completed' })
    ]);

    return { totalBookings, pendingBookings, completedBookings };
  }

  private async getRevenueStats() {
    const revenueData = await this.bookingModel.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total_amount' },
          averageBookingValue: { $avg: '$total_amount' }
        }
      }
    ]);

    const monthlyRevenue = await this.bookingModel.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$total_amount' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    return {
      totalRevenue: revenueData[0]?.totalRevenue || 0,
      averageBookingValue: revenueData[0]?.averageBookingValue || 0,
      monthlyRevenue: monthlyRevenue.reverse()
    };
  }

  private getRoleName(roleId: number): string {
    const roleMap = {
      0: 'Super Admin',
      1: 'Admin',
      2: 'User',
      3: 'Guide'
    };
    return roleMap[roleId] || 'Unknown';
  }

  private async getRecentActivity() {
    const recentUsers = await this.userModel
      .find({ is_deleted: false })
      .select('email name createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentBookings = await this.bookingModel
      .find()
      .populate('user_id', 'email name')
      .populate('tour_id', 'title')
      .select('status total_amount createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    return { recentUsers, recentBookings };
  }

  // ===== SYSTEM SETTINGS =====

  async getSystemSettings() {
    let settings = await this.systemSettingsModel.findOne().exec();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await this.systemSettingsModel.create({
        site_name: 'Packers Haven',
        site_description: 'Your adventure awaits',
        contact_email: 'info@packershaven.com',
        support_phone: '+91-9999999999',
        razorpay_enabled: true,
        email_notifications: true,
        maintenance_mode: false,
        user_registration_enabled: true,
        max_booking_per_user: 10,
        default_user_role: 2,
        session_timeout: 24, // hours
        password_min_length: 6,
        enable_email_verification: true,
        enable_two_factor_auth: false
      });
    }
    
    return settings;
  }

  async updateSystemSettings(settingsData: any) {
    const settings = await this.systemSettingsModel.findOneAndUpdate(
      {},
      settingsData,
      { new: true, upsert: true }
    ).exec();

    return settings;
  }

  // ===== ADMIN LOGS =====

  async logAdminAction(options: LogAdminActionOptions) {
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

  async getAdminLogs(options: GetAdminLogsOptions) {
    const { page, limit, action, entity_type, severity, admin_id, date_from, date_to } = options;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (entity_type) filter.entity_type = entity_type;
    if (severity) filter.severity = severity;
    if (admin_id) filter.admin_id = admin_id;
    
    if (date_from || date_to) {
      filter.createdAt = {};
      if (date_from) filter.createdAt.$gte = date_from;
      if (date_to) filter.createdAt.$lte = date_to;
    }

    const [logs, total] = await Promise.all([
      this.adminLogsModel
        .find(filter)
        .populate('admin_id', 'email name role')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.adminLogsModel.countDocuments(filter).exec(),
    ]);

    return {
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }
  // ===== USER By Id =====
  async getUserById(id: string) {
    // Implement your user retrieval logic here
    // This is a placeholder implementation
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }



  // ===== USER DELETE =====
  async deleteUser(id: string) {
    try {
      // Implement your user deletion logic here
      return await this.userModel.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Failed to delete user');
    }
  }

  // ===== USER ANALYTICS =====
   async getUserAnalytics() {
    // Implement your analytics logic here
    return {
      totalUsers: await this.userModel.countDocuments(),
      activeUsers: await this.userModel.countDocuments({ status: true }),
      blockedUsers: await this.userModel.countDocuments({ blocked: true }),
      usersByRole: await this.userModel.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    };
  }
  // ===== USER UNBLOCK =====  
  async unblockUser(id: string) {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { status: true, blocked: false },
      { new: true }
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // ===== USER BLOCK =====
  async blockUser(id: string) {
    // Find user and update status
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { status: false, blocked: true },
      { new: true }
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  // ===== BULK OPERATIONS =====

  async bulkUserAction(action: string, userIds: string[]) {
    const validActions = ['block', 'unblock', 'delete', 'activate', 'deactivate'];
    
    if (!validActions.includes(action)) {
      throw new BadRequestException(`Invalid action: ${action}`);
    }

    const users = await this.userModel.find({ 
      _id: { $in: userIds },
      role: { $ne: 0 } // Exclude Super Admin from bulk operations
    });

    if (users.length === 0) {
      throw new NotFoundException('No valid users found for bulk operation');
    }

    let updateData: any = {};
    let deletedCount = 0;

    switch (action) {
      case 'block':
        updateData = { status: false, blocked: true, refreshToken: null };
        break;
      case 'unblock':
        updateData = { status: true, blocked: false };
        break;
      case 'activate':
        updateData = { status: true };
        break;
      case 'deactivate':
        updateData = { status: false };
        break;
      case 'delete':
        await this.userModel.deleteMany({ _id: { $in: userIds }, role: { $ne: 0 } });
        await this.bookingModel.deleteMany({ user_id: { $in: userIds } });
        deletedCount = users.length;
        break;
    }

    let modifiedCount = 0;
    if (action !== 'delete') {
      const result = await this.userModel.updateMany(
        { _id: { $in: userIds }, role: { $ne: 0 } },
        updateData
      );
      modifiedCount = result.modifiedCount;
    }

    return {
      action,
      requestedCount: userIds.length,
      processedCount: action === 'delete' ? deletedCount : modifiedCount,
      skippedCount: userIds.length - (action === 'delete' ? deletedCount : modifiedCount)
    };
  }

  // ===== EXPORT FUNCTIONALITY =====

  async exportUsers(format: 'csv' | 'excel', includeDeleted: boolean = false) {
    const filter: any = {};
    if (!includeDeleted) {
      filter.is_deleted = false;
    }

    const users = await this.userModel
      .find(filter)
      .select('-password -refreshToken -emailVerificationToken -passwordResetToken')
      .sort({ createdAt: -1 })
      .exec();

    const exportData = users.map(user => ({
      ID: user._id,
      Email: user.email,
      Name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      Role: this.getRoleName(user.role),
      Status: user.status ? 'Active' : 'Inactive',
      Blocked: user.blocked ? 'Yes' : 'No',
      Email_Verified: user.isEmailVerified ? 'Yes' : 'No',
      Phone: user.phone_number ? `+${user.phone_code} ${user.phone_number}` : '',
      Country: user.country_code || '',
      Created_At: user.createdAt,
      Updated_At: user.updatedAt,
      Deleted: user.is_deleted ? 'Yes' : 'No',
      Deleted_Date: user.is_deleted_date || ''
    }));
    return {
      data: exportData,
      format,
      filename: `users_export_${new Date().toISOString().split('T')[0]}.${format}`
    };
  }
}
