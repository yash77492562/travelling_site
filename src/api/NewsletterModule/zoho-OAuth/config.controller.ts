// config.controller.ts (Optional - for admin management)
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ZohoOAuthService } from './zoho-oauth.service';
import { JwtAuthGuard } from '../../AuthModule/jwt-auth.guard';
import { RolesGuard } from '../../AdminModule/admin.roles-guards';
import { Roles } from '../../AdminModule/admin.roles-decorators';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1) // Admin only
export class ConfigController {
  constructor(private readonly zohoOAuthService: ZohoOAuthService) {}

  /**
   * Get all config values (for debugging)
   */
  @Get()
  async getAllConfigs() {
    return this.zohoOAuthService.getAllConfigValues();
  }

  /**
   * Set a config value
   */
  @Post()
  async setConfig(@Body() configData: {
    key: string;
    value: any;
    expiresAt?: string; // ISO date string
  }) {
    const expiresAt = configData.expiresAt ? new Date(configData.expiresAt) : undefined;
    await this.zohoOAuthService.setConfigValue(configData.key, configData.value, expiresAt);
    
    return {
      message: 'Config value set successfully',
      key: configData.key
    };
  }

  /**
   * Get a specific config value
   */
  @Get(':key')
  async getConfig(@Param('key') key: string) {
    const value = await this.zohoOAuthService.getConfigValue(key);
    
    return {
      key,
      value,
      exists: value !== null
    };
  }

  /**
   * Delete a config value
   */
  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Param('key') key: string) {
    // This would need to be implemented in the service
    // For now, you can manually delete from database
    await this.zohoOAuthService.deleteConfigValue(key);
    return;
  }

  /**
   * Clear Zoho tokens (force re-authorization)
   */
  @Delete('zoho-tokens')
  async clearZohoTokens() {
    await this.zohoOAuthService.clearTokens();
    
    return {
      message: 'Zoho tokens cleared successfully. Re-authorization required.'
    };
  }

  /**
   * Get Zoho token status
   */
  @Get('zoho-tokens/status')
  async getZohoTokenStatus() {
    const status = this.zohoOAuthService.getTokenStatus();
    
    return {
      message: 'Zoho token status retrieved',
      ...status
    };
  }
}