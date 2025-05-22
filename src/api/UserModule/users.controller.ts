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
  HttpException
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { StatusCode, StatusMessage } from '../../constants/HttpConstant';
import { MessageConstant } from '../../constants/MessageConstant';



@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.usersService.create(createUserDto);
      return {
        statusCode: StatusCode.HTTP_CREATED,
        message: MessageConstant.CREATE_SUCCESSFULLY,
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: StatusCode.HTTP_BAD_REQUEST,
          message: error.message || StatusMessage.HTTP_BAD_REQUEST,
        },
        StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: boolean,
    @Query('role') role?: number,
  ) {
    try {
      const result = await this.usersService.findAll({
        page: Number(page),
        limit: Number(limit),
        status,
        role: role ? Number(role) : undefined,
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

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const user = await this.usersService.findOne(id);
      if (!user) {
        throw new HttpException(
          {
            statusCode: StatusCode.HTTP_NOT_FOUND,
            message: MessageConstant.DATA_NOT_FOUND,
          },
          StatusCode.HTTP_NOT_FOUND,
        );
      }
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

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const user = await this.usersService.update(id, updateUserDto);
      if (!user) {
        throw new HttpException(
          {
            statusCode: StatusCode.HTTP_NOT_FOUND,
            message: MessageConstant.DATA_NOT_FOUND,
          },
          StatusCode.HTTP_NOT_FOUND,
        );
      }
      return {
        statusCode: StatusCode.HTTP_OK,
        message: MessageConstant.UPDATED_SUCCESS,
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_BAD_REQUEST,
          message: error.message || 'Failed to update user',
        },
        error.status || StatusCode.HTTP_BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const result = await this.usersService.remove(id);
      if (!result) {
        throw new HttpException(
          {
            statusCode: StatusCode.HTTP_NOT_FOUND,
            message: 'User not found',
          },
          StatusCode.HTTP_NOT_FOUND,
        );
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'User deleted successfully',
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to delete user',
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/soft-delete')
  async softDelete(@Param('id') id: string) {
    try {
      const user = await this.usersService.softDelete(id);
      if (!user) {
        throw new HttpException(
          {
            statusCode: StatusCode.HTTP_NOT_FOUND,
            message: 'User not found',
          },
          StatusCode.HTTP_NOT_FOUND,
        );
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'User soft deleted successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to soft delete user',
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/restore')
  async restore(@Param('id') id: string) {
    try {
      const user = await this.usersService.restore(id);
      if (!user) {
        throw new HttpException(
          {
            statusCode: StatusCode.HTTP_NOT_FOUND,
            message: 'User not found',
          },
          StatusCode.HTTP_NOT_FOUND,
        );
      }
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'User restored successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to restore user',
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new HttpException(
          {
            statusCode: StatusCode.HTTP_NOT_FOUND,
            message: 'User not found',
          },
          StatusCode.HTTP_NOT_FOUND,
        );
      }
      return {
        statusCode: StatusCode.HTTP_OK,
        message: 'User retrieved successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve user',
        },
        error.status || StatusCode.HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }
}