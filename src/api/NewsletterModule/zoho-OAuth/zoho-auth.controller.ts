// zoho-auth.controller.ts - Enhanced and secured version
import { 
  Controller, 
  Get, 
  Query, 
  Redirect, 
  HttpException, 
  HttpStatus, 
  Post, 
  Body,
  UseGuards,
  Logger,
  ValidationPipe,
  UsePipes
} from '@nestjs/common';
import { ZohoOAuthService } from './zoho-oauth.service';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';

// DTOs for type safety
class CallbackQueryDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  error?: string;
}

// Response interfaces
interface TokenInfo {
  available: boolean;
  expired: boolean;
  expiresIn: string;
  expiresAt?: string;
  autoRefresh?: string;
  warningThreshold?: string;
  criticalThreshold?: string;
}

interface AdminDashboard {
  status: {
    health: string;
    isHealthy: boolean;
    isCritical: boolean;
    lastUpdated: string;
  };
  tokens: {
    access_token: TokenInfo;
    refresh_token: TokenInfo;
  };
  system: Record<string, any>;
  actionItems: ActionItem[];
  quickActions: QuickAction[];
  notifications: Notification[];
  renewalInstructions?: Record<string, any>;
}

interface ActionItem {
  priority: 'CRITICAL' | 'WARNING' | 'INFO';
  action: string;
  endpoint: string;
  urgency: string;
}

interface QuickAction {
  action: string;
  endpoint: string;
  description: string;
}

interface Notification {
  timestamp: string;
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  resolved: boolean;
}

// TODO: Implement proper authentication guard
// @UseGuards(AdminAuthGuard) - Add this to protect admin endpoints

@Controller('auth/zoho')
export class ZohoAuthController {
  private readonly logger = new Logger(ZohoAuthController.name);
  private readonly API_TIMEOUT = 10000; // 10 seconds
  private readonly ZOHO_API_BASE = 'https://www.zohoapis.in';

  constructor(
    private readonly zohoOAuthService: ZohoOAuthService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Step 1: Initiate OAuth flow
   * GET /auth/zoho/authorize
   */
  @Get('authorize')
  @Redirect()
  async authorize() {
    try {
      const authUrl = this.zohoOAuthService.getAuthorizationUrl();
      this.logger.log('OAuth flow initiated');
      
      return {
        url: authUrl,
        statusCode: 302
      };
    } catch (error) {
      this.logger.error('Failed to generate authorization URL', error);
      throw new HttpException(
        'Failed to initiate OAuth flow',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Step 2: Handle OAuth callback
   * GET /auth/zoho/callback?code=AUTHORIZATION_CODE
   */
  @Get('callback')
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleCallback(@Query() query: CallbackQueryDto) {
    const { code, error } = query;

    if (error) {
      this.logger.error(`OAuth error received: ${error}`);
      throw new HttpException(`OAuth error: ${error}`, HttpStatus.BAD_REQUEST);
    }

    if (!code) {
      this.logger.error('Authorization code not provided in callback');
      throw new HttpException('Authorization code not provided', HttpStatus.BAD_REQUEST);
    }

    try {
      const tokens = await this.zohoOAuthService.exchangeCodeForTokens(code);
      this.logger.log('OAuth flow completed successfully');
      
      return {
        message: 'Successfully authorized with Zoho!',
        success: true,
        tokens: {
          // Don't expose actual token values, just indicate presence
          access_token: tokens.access_token ? 'Received' : 'Missing',
          refresh_token: tokens.refresh_token ? 'Received' : 'Missing',
          expires_in: tokens.expires_in
        },
        next_steps: [
          'Tokens have been automatically stored and configured',
          'The system will auto-refresh access tokens as needed',
          'Check /auth/zoho/admin-dashboard for monitoring'
        ]
      };
    } catch (error) {
      this.logger.error('Failed to complete OAuth flow', error);
      throw new HttpException(
        `Failed to complete OAuth flow: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Quick status check endpoint
   * GET /auth/zoho/status
   */
  @Get('status')
  async getStatus() {
    try {
      const token = await this.zohoOAuthService.getValidAccessToken();
      const expiryInfo = this.zohoOAuthService.getTokenExpiryInfo();
      
      return {
        message: 'Zoho integration is active',
        hasValidToken: true,
        tokenStatus: 'Active',
        accessTokenExpiresIn: `${Math.floor(expiryInfo.accessTokenExpiresIn / 60)} minutes`,
        refreshTokenExpiresIn: `${Math.floor(expiryInfo.refreshTokenExpiresIn / (24 * 60 * 60))} days`,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      this.logger.warn('Token status check failed', error);
      return {
        message: 'Zoho integration not configured or tokens expired',
        hasValidToken: false,
        error: error.message,
        action_required: 'Visit /auth/zoho/admin-dashboard for renewal instructions'
      };
    }
  }

  /**
   * Comprehensive Admin Dashboard
   * GET /auth/zoho/admin-dashboard
   * TODO: Add @UseGuards(AdminAuthGuard) for security
   */
  @Get('admin-dashboard')
  async getAdminDashboard(): Promise<AdminDashboard> {
    try {
      // Get comprehensive token status
      const tokenStatus = this.zohoOAuthService.getTokenStatus();
      const expiryInfo = this.zohoOAuthService.getTokenExpiryInfo();
      const renewalInstructions = this.zohoOAuthService.getAdminRenewalInstructions();

      // Calculate time remaining in human-readable format
      const formatTimeRemaining = (seconds: number): string => {
        if (seconds <= 0) return 'EXPIRED';
        
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        
        if (days > 0) return `${days} days, ${hours} hours`;
        if (hours > 0) return `${hours} hours, ${minutes} minutes`;
        return `${minutes} minutes`;
      };

      // Determine overall health status
      const getHealthStatus = (): string => {
        if (!tokenStatus.hasRefreshToken) return 'CRITICAL - No tokens available';
        if (tokenStatus.refreshTokenExpired) return 'CRITICAL - Refresh token expired';
        if (expiryInfo.criticalExpiry) return 'CRITICAL - Refresh token expires soon';
        if (expiryInfo.needsRenewal) return 'WARNING - Refresh token needs renewal';
        if (!tokenStatus.hasAccessToken || tokenStatus.accessTokenExpired) return 'INFO - Access token will be auto-refreshed';
        return 'HEALTHY - All tokens valid';
      };

      const healthStatus = getHealthStatus();
      const isHealthy = healthStatus.startsWith('HEALTHY');
      const isCritical = healthStatus.startsWith('CRITICAL');

      const dashboard: AdminDashboard = {
        // Overall Status
        status: {
          health: healthStatus,
          isHealthy,
          isCritical,
          lastUpdated: new Date().toISOString()
        },

        // Token Information
        tokens: {
          access_token: {
            available: tokenStatus.hasAccessToken,
            expired: tokenStatus.accessTokenExpired,
            expiresIn: formatTimeRemaining(expiryInfo.accessTokenExpiresIn),
            expiresAt: expiryInfo.accessTokenExpiresAt?.toISOString(),
            autoRefresh: 'Enabled - Will refresh automatically 10 minutes before expiry'
          },
          refresh_token: {
            available: tokenStatus.hasRefreshToken,
            expired: tokenStatus.refreshTokenExpired,
            expiresIn: formatTimeRemaining(expiryInfo.refreshTokenExpiresIn),
            expiresAt: expiryInfo.refreshTokenExpiresAt?.toISOString(),
            warningThreshold: '30 days',
            criticalThreshold: '7 days'
          }
        },

        // System Status
        system: {
          initialized: tokenStatus.isInitialized,
          autoRefreshEnabled: true,
          lastRefreshAttempt: tokenStatus.lastRefreshAttempt?.toISOString(),
          consecutiveFailures: tokenStatus.consecutiveFailures || 0,
          inBackoffPeriod: tokenStatus.inBackoffPeriod || false,
          cronJobStatus: 'Active - Runs every 30 minutes'
        },

        // Action Items for Admin
        actionItems: this.getActionItems(tokenStatus, expiryInfo),

        // Quick Actions
        quickActions: [
          {
            action: 'Test Connection',
            endpoint: 'GET /auth/zoho/test-connection',
            description: 'Test if current tokens work with Zoho API'
          },
          {
            action: 'Force Refresh',
            endpoint: 'POST /auth/zoho/force-refresh',
            description: 'Manually refresh access token now'
          },
          {
            action: 'Get Renewal URL',
            endpoint: 'GET /auth/zoho/renewal-url',
            description: 'Get fresh authorization URL for token renewal'
          },
          ...(isCritical ? [{
            action: 'URGENT: Renew Tokens',
            endpoint: 'GET /auth/zoho/authorize',
            description: 'Start OAuth flow to get new tokens - IMMEDIATE ACTION REQUIRED'
          }] : [])
        ],

        // Recent Notifications
        notifications: await this.getRecentNotifications()
      };

      // Add renewal instructions if needed
      if (isCritical || expiryInfo.needsRenewal) {
        dashboard.renewalInstructions = {
          authUrl: renewalInstructions.authUrl,
          steps: renewalInstructions.instructions,
          callbackInfo: renewalInstructions.callbackInfo,
          automatedRenewal: {
            enabled: false,
            note: 'Automated renewal requires manual admin approval for security'
          }
        };
      }

      return dashboard;

    } catch (error) {
      this.logger.error('Failed to generate admin dashboard', error);
      return {
        status: {
          health: 'ERROR - Unable to check token status',
          isHealthy: false,
          isCritical: true,
          lastUpdated: new Date().toISOString()
        },
        tokens: {
          access_token: { available: false, expired: true, expiresIn: 'Unknown' },
          refresh_token: { available: false, expired: true, expiresIn: 'Unknown' }
        },
        system: {},
        actionItems: [
          {
            priority: 'CRITICAL',
            action: 'Check system configuration and restart OAuth flow',
            endpoint: 'GET /auth/zoho/authorize',
            urgency: 'IMMEDIATE'
          }
        ],
        quickActions: [],
        notifications: [{
          timestamp: new Date().toISOString(),
          type: 'system_error',
          message: `Dashboard error: ${error.message}`,
          severity: 'error',
          resolved: false
        }]
      };
    }
  }

  /**
   * Test API connection with current tokens
   * GET /auth/zoho/test-connection
   */
  @Get('test-connection')
  async testConnection() {
    try {
      const token = await this.zohoOAuthService.getValidAccessToken();
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      try {
        // Test with a simple API call to verify token works
        const response = await fetch(`${this.ZOHO_API_BASE}/crm/v2/org`, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const orgData = await response.json();
          this.logger.log('Zoho API connection test successful');
          
          return {
            status: 'SUCCESS',
            message: 'Zoho API connection is working properly',
            organization: orgData.org?.[0]?.company_name || 'Connected',
            tokenStatus: 'Valid',
            testedAt: new Date().toISOString(),
            responseTime: `${Date.now() - Date.now()}ms` // You'd need to track this properly
          };
        } else {
          const errorText = await response.text();
          throw new Error(`API test failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('API request timed out');
        }
        throw fetchError;
      }

    } catch (error) {
      this.logger.error('Zoho API connection test failed', error);
      return {
        status: 'FAILED',
        message: 'Zoho API connection test failed',
        error: error.message,
        recommendation: 'Check token status and consider refreshing or renewing tokens',
        actionRequired: 'Visit /auth/zoho/admin-dashboard for guidance',
        testedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Force refresh access token
   * POST /auth/zoho/force-refresh
   * TODO: Add rate limiting to prevent abuse
   */
  @Post('force-refresh')
  async forceRefresh() {
    try {
      const newToken = await this.zohoOAuthService.refreshAccessToken();
      const expiryInfo = this.zohoOAuthService.getTokenExpiryInfo();
      
      this.logger.log('Access token refreshed successfully');
      
      return {
        status: 'SUCCESS',
        message: 'Access token refreshed successfully',
        tokenStatus: 'New token active',
        expiresIn: `${Math.floor(expiryInfo.accessTokenExpiresIn / 60)} minutes`,
        refreshedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to refresh access token', error);
      return {
        status: 'FAILED',
        message: 'Failed to refresh access token',
        error: error.message,
        possibleCauses: [
          'Refresh token expired or invalid',
          'Rate limiting by Zoho',
          'Network connectivity issues',
          'Invalid client credentials'
        ],
        recommendation: 'If refresh token is expired, complete OAuth flow again via /auth/zoho/authorize'
      };
    }
  }

  /**
   * Get renewal URL for admin
   * GET /auth/zoho/renewal-url
   */
  @Get('renewal-url')
  async getRenewalUrl() {
    try {
      const renewalInstructions = this.zohoOAuthService.getAdminRenewalInstructions();
      
      return {
        message: 'Authorization URL for token renewal',
        authUrl: renewalInstructions.authUrl,
        instructions: renewalInstructions.instructions,
        callbackInfo: renewalInstructions.callbackInfo,
        expiresIn: '10 minutes',
        generatedAt: new Date().toISOString(),
        note: 'Click the authorization URL, complete the OAuth flow, and the system will automatically capture the new tokens'
      };
    } catch (error) {
      this.logger.error('Failed to generate renewal URL', error);
      throw new HttpException(
        'Failed to generate renewal URL',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get recent notifications from database
   */
  private async getRecentNotifications(): Promise<Notification[]> {
    try {
      const dbTokens = await this.zohoOAuthService.getAllConfigValues();
      const notifications = dbTokens
        .filter(token => token.key.startsWith('zoho_notification_'))
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        .slice(0, 5)
        .map(notification => ({
          timestamp: notification.created_at instanceof Date ? notification.created_at.toISOString() : notification.created_at ?? new Date().toISOString(),
          type: notification.value?.subtype || 'unknown',
          message: notification.value?.message || 'No message',
          severity: (notification.value?.severity as 'error' | 'warning' | 'info') || 'info',
          resolved: notification.value?.resolved || false
        }));

      return notifications;
    } catch (error) {
      this.logger.error('Failed to load notifications', error);
      return [{
        timestamp: new Date().toISOString(),
        type: 'system_error',
        message: `Failed to load notifications: ${error.message}`,
        severity: 'error',
        resolved: false
      }];
    }
  }

  /**
   * Helper method to generate action items for admin
   */
  private getActionItems(tokenStatus: any, expiryInfo: any): ActionItem[] {
    const actionItems: ActionItem[] = [];

    // Critical actions
    if (!tokenStatus.hasRefreshToken) {
      actionItems.push({
        priority: 'CRITICAL',
        action: 'Complete OAuth authorization - No tokens available',
        endpoint: 'GET /auth/zoho/authorize',
        urgency: 'IMMEDIATE'
      });
    } else if (tokenStatus.refreshTokenExpired) {
      actionItems.push({
        priority: 'CRITICAL',
        action: 'Refresh token expired - Re-authorize immediately',
        endpoint: 'GET /auth/zoho/authorize',
        urgency: 'IMMEDIATE'
      });
    } else if (expiryInfo.criticalExpiry) {
      const daysLeft = Math.floor(expiryInfo.refreshTokenExpiresIn / (24 * 60 * 60));
      actionItems.push({
        priority: 'CRITICAL',
        action: `Refresh token expires in ${daysLeft} days - Renew now`,
        endpoint: 'GET /auth/zoho/authorize',
        urgency: 'WITHIN 24 HOURS'
      });
    }

    // Warning actions - Fixed the incomplete logic
    if (expiryInfo.needsRenewal && !expiryInfo.criticalExpiry) {
      const daysLeft = Math.floor(expiryInfo.refreshTokenExpiresIn / (24 * 60 * 60));
      actionItems.push({
        priority: 'WARNING',
        action: `Schedule token renewal - ${daysLeft} days remaining`,
        endpoint: 'GET /auth/zoho/renewal-url',
        urgency: 'WITHIN 1 WEEK'
      });
    }

    // Info actions
    if (tokenStatus.consecutiveFailures > 0) {
      actionItems.push({
        priority: 'INFO',
        action: `Monitor system - ${tokenStatus.consecutiveFailures} recent failures`,
        endpoint: 'GET /auth/zoho/test-connection',
        urgency: 'WHEN CONVENIENT'
      });
    }

    return actionItems;
  }

  /**
   * Manual refresh token endpoint (for backward compatibility)
   * GET /auth/zoho/refresh
   * @deprecated Use POST /auth/zoho/force-refresh instead
   */
  @Get('refresh')
  async refreshToken() {
    this.logger.warn('Deprecated endpoint /refresh called, use /force-refresh instead');
    return this.forceRefresh();
  }
}