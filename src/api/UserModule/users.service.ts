import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { User } from '../../schemas/user.schema';

interface FindAllOptions {
  page: number;
  limit: number;
  status?: boolean;
  role?: number;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    console.log('Creating user:', createUserDto);
    
    // Check if user already exists
    const existingUser = await this.userModel.findOne({ 
      email: createUserDto.email,
      is_deleted: false 
    });
    
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await argon2.hash(createUserDto.password);
    
    const userData = {
      ...createUserDto,
      password: hashedPassword,
      is_deleted: false,
      status: createUserDto.status ?? true,
      role: createUserDto.role ?? 2,
    };
    
    const createdUser = new this.userModel(userData);
    const savedUser = await createdUser.save();
    
    // Remove password from response
    const userObject = savedUser.toObject();
    delete userObject.password;
    
    console.log('User created:', userObject);
    return userObject as User;
  }

  async findAll(options: FindAllOptions) {
    const { page, limit, status, role } = options;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter: any = { is_deleted: false };
    if (status !== undefined) {
      filter.status = status;
    }
    if (role !== undefined) {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel
      .findOne({ _id: id, is_deleted: false })
      .select('-password')
      .exec();
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase(), is_deleted: false })
      .select('-password')
      .exec();
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return user;
  }

  async findByEmailWithPassword(email: string): Promise<User> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase(), is_deleted: false })
      .exec();
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return user;
  }

  async findByResetToken(token: string): Promise<User> {
    const user = await this.userModel
      .findOne({ 
        passwordResetToken: token,
        is_deleted: false,
        passwordResetExpires: { $gt: new Date() }
      })
      .exec();
    
    if (!user) {
      throw new NotFoundException('Invalid or expired reset token');
    }
    
    return user;
  }

  async findByEmailVerificationToken(token: string): Promise<User> {
    const user = await this.userModel
      .findOne({ 
        emailVerificationToken: token,
        is_deleted: false
      })
      .exec();
    
    if (!user) {
      throw new NotFoundException('Invalid verification token');
    }
    
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel.findOne({ _id: id, is_deleted: false });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being updated and if it's already taken
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userModel.findOne({ 
        email: updateUserDto.email.toLowerCase(),
        is_deleted: false,
        _id: { $ne: id }
      });
      
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
      // Ensure email is lowercase
      updateUserDto.email = updateUserDto.email.toLowerCase();
    }

    // Hash password if it's being updated
    if (updateUserDto.password) {
      updateUserDto.password = await argon2.hash(updateUserDto.password);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('Failed to update user');
    }

    return updatedUser;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.userModel
      .findOneAndDelete({ _id: id, is_deleted: false })
      .exec();
    
    return !!result;
  }

  async softDelete(id: string): Promise<User> {
    const user = await this.userModel.findOne({ _id: id, is_deleted: false });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        id,
        { 
          is_deleted: true, 
          is_deleted_date: new Date()
        },
        { new: true }
      )
      .select('-password')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('Failed to update user');
    }

    return updatedUser;
  }

  async restore(id: string): Promise<User> {
    const user = await this.userModel.findOne({ _id: id, is_deleted: true });
    
    if (!user) {
      throw new NotFoundException('Deleted user not found');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        id,
        { 
          is_deleted: false, 
          is_deleted_date: null 
        },
        { new: true }
      )
      .select('-password')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('Failed to restore user');
    }

    return updatedUser;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.findByEmailWithPassword(email);
      
      if (user && user.password && await argon2.verify(user.password, password)) {
        const userObject = user.toObject();
        delete userObject.password;
        return userObject;
      }
      
      return null;
    } catch (error) {
      console.error('Error validating user:', error);
      return null;
    }
  }

  async updateUserStatus(id: string, status: boolean): Promise<User> {
    const user = await this.userModel.findOne({ _id: id, is_deleted: false });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .select('-password')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('Failed to update user status');
    }

    return updatedUser;
  }

  async getUsersByRole(role: number): Promise<User[]> {
    return this.userModel
      .find({ role, is_deleted: false })
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getUserStats() {
    const [totalUsers, activeUsers, deletedUsers] = await Promise.all([
      this.userModel.countDocuments({ is_deleted: false }),
      this.userModel.countDocuments({ is_deleted: false, status: true }),
      this.userModel.countDocuments({ is_deleted: true }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      deletedUsers,
    };
  }
}