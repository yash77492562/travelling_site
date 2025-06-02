
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Config } from '../../../schemas/config.schema';
import axios, { AxiosError } from 'axios';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';

// Valid Zoho regions
const VALID_ZOHO_REGIONS = ['com', 'in', 'eu', 'au'];

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface RateLimitTracker {
  lastRefreshAttempt: Date;
  consecutiveFailures: number;
  backoffUntil: Date | null;
}

interface TokenExpiryInfo {
  accessTokenExpiresIn: number; // seconds
  refreshTokenExpiresIn: number; // seconds
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  needsRenewal: boolean;
  criticalExpiry: boolean;
}

interface ZohoContactData {
  email: string;
  name?: string;
  phone?: string;
  interests?: string[];
}

interface ZohoCampaignData {
  subject: string;
  content: string;
  recipientEmails: string[];
}

interface CircuitBreaker {
  failures: number;
  isOpen: boolean;
  lastFailure: Date | null;
  nextRetryAt: Date | null;
}

interface ServiceMetrics {
  tokensRefreshed: number;
  apiCallsSuccessful: number;
  apiCallsFailed: number;
  lastSuccessfulCall: Date | null;
  lastFailure: Date | null;
  contactsCreated: number;
  campaignsSent: number;
}

interface CacheEntry<T> {
  data: T;
  expires: Date;
}

@Injectable()
export class ZohoOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private encryptionKey: string;
  private zohoAccountsUrl: string;
  private zohoApiUrl: string;
  private readonly apiTimeout: number;
  private readonly REFRESH_TOKEN_LIFETIME_DAYS: number;
  private readonly MIN_REFRESH_INTERVAL: number;
  private readonly MAX_CONSECUTIVE_FAILURES: number;
  private readonly BASE_BACKOFF_MS: number;
  private readonly MAX_BACKOFF_MS: number;
  private readonly ACCESS_TOKEN_BUFFER_MINUTES: number;
  private readonly REFRESH_TOKEN_WARNING_DAYS: number;
  private readonly CRITICAL_WARNING_DAYS: number;
  private readonly CIRCUIT_BREAKER_THRESHOLD: number;
  private readonly CIRCUIT_BREAKER_TIMEOUT: number;
  private readonly CACHE_TTL: number;
  private readonly CRON_SCHEDULE: string;

  // Store tokens in memory for quick access
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private refreshTokenExpiry: Date | null = null;
  private isInitialized = false;

  // Rate limiting and error tracking
  private rateLimitTracker: RateLimitTracker = {
    lastRefreshAttempt: new Date(0),
    consecutiveFailures: 0,
    backoffUntil: null
  };

  private circuitBreaker: CircuitBreaker = {
    failures: 0,
    isOpen: false,
    lastFailure: null,
    nextRetryAt: null
  };

  // Metrics and caching
  private metrics: ServiceMetrics = {
    tokensRefreshed: 0,
    apiCallsSuccessful: 0,
    apiCallsFailed: 0,
    lastSuccessfulCall: null,
    lastFailure: null,
    contactsCreated: 0,
    campaignsSent: 0
  };

  private cache = new Map<string, CacheEntry<any>>();

  constructor(
    @InjectModel(Config.name) private configModel: Model<Config>
  ) {
    // Validate required environment variables
    this.validateEnvironmentVariables();

    // Initialize from environment variables
    this.clientId = process.env.ZOHO_CLIENT_ID!;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET!;
    this.redirectUri = process.env.ZOHO_REDIRECT_URI!;
    this.encryptionKey = process.env.ZOHO_ENCRYPTION_KEY || '';
    if (!this.encryptionKey) {
      this.initializeEncryptionKey();
    }

    // Configurable settings
    const region = process.env.ZOHO_REGION || 'in';
    if (!VALID_ZOHO_REGIONS.includes(region)) {
      throw new Error(`Invalid ZOHO_REGION: ${region}. Must be one of ${VALID_ZOHO_REGIONS.join(', ')}`);
    }
    this.zohoAccountsUrl = `https://accounts.zoho.${region}`;
    this.zohoApiUrl = `https://www.zohoapis.${region}`;
    this.apiTimeout = Number(process.env.ZOHO_API_TIMEOUT) || 30000;
    this.REFRESH_TOKEN_LIFETIME_DAYS = Number(process.env.ZOHO_REFRESH_TOKEN_LIFETIME_DAYS) || 365;
    this.MIN_REFRESH_INTERVAL = Number(process.env.ZOHO_MIN_REFRESH_INTERVAL) || 30000;
    this.MAX_CONSECUTIVE_FAILURES = Number(process.env.ZOHO_MAX_CONSECUTIVE_FAILURES) || 3;
    this.BASE_BACKOFF_MS = Number(process.env.ZOHO_BASE_BACKOFF_MS) || 60000;
    this.MAX_BACKOFF_MS = Number(process.env.ZOHO_MAX_BACKOFF_MS) || 600000;
    this.ACCESS_TOKEN_BUFFER_MINUTES = Number(process.env.ZOHO_ACCESS_TOKEN_BUFFER_MINUTES) || 10;
    this.REFRESH_TOKEN_WARNING_DAYS = Number(process.env.ZOHO_REFRESH_TOKEN_WARNING_DAYS) || 30;
    this.CRITICAL_WARNING_DAYS = Number(process.env.ZOHO_CRITICAL_WARNING_DAYS) || 7;
    this.CIRCUIT_BREAKER_THRESHOLD = Number(process.env.ZOHO_CIRCUIT_BREAKER_THRESHOLD) || 5;
    this.CIRCUIT_BREAKER_TIMEOUT = Number(process.env.ZOHO_CIRCUIT_BREAKER_TIMEOUT) || 300000;
    this.CACHE_TTL = Number(process.env.ZOHO_CACHE_TTL) || 300000;
    this.CRON_SCHEDULE = process.env.ZOHO_CRON_SCHEDULE || '0 */30 * * * *';
  }

  /**
   * Validates required environment variables for Zoho OAuth.
   * @throws {Error} If any required environment variables are missing.
   */
  private validateEnvironmentVariables(): void {
    const requiredVars = [
      'ZOHO_CLIENT_ID',
      'ZOHO_CLIENT_SECRET',
      'ZOHO_REDIRECT_URI'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ All required Zoho environment variables validated');
  }

  /**
   * Generates an encryption key if not provided in environment variables.
   * In production, requires ZOHO_ENCRYPTION_KEY to be set.
   * @throws {Error} If ZOHO_ENCRYPTION_KEY is not set in production.
   */
  private async initializeEncryptionKey(): Promise<void> {
    try {
      this.encryptionKey = await this.generateEncryptionKey();
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw error;
    }
  }

  /**
   * Generates a new encryption key.
   * @returns Generated encryption key.
   * @throws {Error} If ZOHO_ENCRYPTION_KEY is not set in production.
   */
  private async generateEncryptionKey(): Promise<string> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ZOHO_ENCRYPTION_KEY must be set in production');
    }

    const key = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ Generated new encryption key. Persisting to database for this session.');

    // Persist the generated key to the database
    await this.setConfigValue('zoho_encryption_key', key);
    return key;
  }

  /**
   * Encrypts sensitive data before storage.
   * @param text Data to encrypt.
   * @returns Encrypted string in the format iv:encrypted.
   * @throws {Error} If encryption fails.
   */
  private encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('❌ Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts sensitive data after retrieval.
   * @param encryptedText Encrypted data in the format iv:encrypted.
   * @returns Decrypted string.
   * @throws {Error} If decryption fails.
   */
  private decrypt(encryptedText: string): string {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('❌ Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Validates email format.
   * @param email Email address to validate.
   * @returns True if valid, false otherwise.
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates phone number format (basic validation).
   * @param phone Phone number to validate.
   * @returns True if valid, false otherwise.
   */
  private validatePhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Executes an API call with circuit breaker protection.
   * @param apiCall The API call to execute.
   * @param operation Name of the operation for logging.
   * @returns Result of the API call.
   * @throws {HttpException} If circuit breaker is open or API call fails.
   */
  private async withCircuitBreaker<T>(apiCall: () => Promise<T>, operation: string): Promise<T> {
    if (this.circuitBreaker.isOpen) {
      const now = new Date();
      if (this.circuitBreaker.nextRetryAt && now < this.circuitBreaker.nextRetryAt) {
        const waitTime = Math.ceil((this.circuitBreaker.nextRetryAt.getTime() - now.getTime()) / 1000);
        throw new HttpException(
          `Circuit breaker is open for ${operation}. Retry in ${waitTime} seconds.`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      } else {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
        console.log('🔄 Circuit breaker reset, attempting retry...');
      }
    }

    try {
      const result = await apiCall();
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.lastFailure = null;
      this.circuitBreaker.nextRetryAt = null;
      this.metrics.apiCallsSuccessful++;
      this.metrics.lastSuccessfulCall = new Date();
      return result;
    } catch (error) {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = new Date();
      this.metrics.apiCallsFailed++;
      this.metrics.lastFailure = new Date();
      if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitBreaker.isOpen = true;
        this.circuitBreaker.nextRetryAt = new Date(Date.now() + this.CIRCUIT_BREAKER_TIMEOUT);
        console.error(`🚫 Circuit breaker opened for ${operation} after ${this.circuitBreaker.failures} failures`);
      }
      throw error;
    }
  }

  /**
   * Sets a cache entry with a TTL.
   * @param key Cache key.
   * @param data Data to cache.
   * @param ttlMs Time to live in milliseconds.
   */
  private setCacheEntry<T>(key: string, data: T, ttlMs: number = this.CACHE_TTL): void {
    console.warn('⚠️ Using in-memory cache. Consider Redis for multi-instance deployments.');
    const expires = new Date(Date.now() + ttlMs);
    this.cache.set(key, { data, expires });
  }

  private getCacheEntry<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expires <= new Date()) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private clearExpiredCache(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stores tokens in the database with encryption.
   * @param tokens Token data to store.
   */
  private async storeTokensInDatabase(tokens: TokenData): Promise<void> {
    try {
      const accessExpiresAt = this.createSafeExpiryDate(tokens.expires_in);
      const refreshExpiresAt = this.createSafeExpiryDate(this.REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60);
      const encryptedTokens = {
        access_token: this.encrypt(tokens.access_token),
        refresh_token: this.encrypt(tokens.refresh_token),
        expires_in: tokens.expires_in,
        refresh_token_expires_at: refreshExpiresAt.toISOString()
      };
      await this.configModel.updateOne(
        { key: 'zoho_tokens_encrypted' },
        {
          key: 'zoho_tokens_encrypted',
          value: encryptedTokens,
          expires_at: accessExpiresAt
        },
        { upsert: true }
      );
      console.log('✅ Encrypted tokens stored in database successfully');
    } catch (error) {
      console.error('❌ Error storing encrypted tokens:', error);
      throw new Error(`Failed to store tokens: ${error.message}`);
    }
  }

  /**
   * Loads and decrypts tokens from the database.
   */
  async loadTokensFromDatabase(): Promise<void> {
    try {
      console.log('🔄 Loading encrypted tokens from database...');
      const tokenConfig = await this.configModel.findOne({ key: 'zoho_tokens_encrypted' });
      if (tokenConfig && tokenConfig.value) {
        console.log('📄 Found encrypted token config');
        try {
          if (tokenConfig.value.refresh_Token) {
            this.refreshToken = this.decrypt(tokenConfig.value.refresh_token);
            console.log('✅ Refresh token decrypted and loaded');
            if (tokenConfig.value.refresh_token_expires_at) {
              this.refreshTokenExpiry = this.createValidDate(tokenConfig.value.refresh_token_expires_at);
            }
          }
          const expiryDate = this.createValidDate(tokenConfig.expires_at);
          const isExpired = expiryDate ? expiryDate <= new Date() : true;
          if (!isExpired && tokenConfig.value.access_token) {
            this.accessToken = this.decrypt(tokenConfig.value.access_token);
            this.tokenExpiry = expiryDate;
            console.log('✅ Access token decrypted and loaded');
          } else {
            console.log('⚠️ Access token expired or invalid');
          }
        } catch (decryptError) {
          console.error('❌ Error decrypting tokens:', decryptError);
          await this.clearTokens();
          throw new Error('Token decryption failed. Please re-authorize.');
        }
        return;
      }
      await this.migrateUnencryptedTokens();
    } catch (error) {
      console.error('❌ Error loading tokens from database:', error);
      throw error;
    }
  }

  /**
   * Migrates unencrypted tokens to encrypted format.
   */
  private async migrateUnencryptedTokens(): Promise<void> {
    try {
      console.log('🔄 Checking for unencrypted tokens to migrate...');
      const oldTokenConfig = await this.configModel.findOne({ key: 'zoho_tokens' });
      if (oldTokenConfig && oldTokenConfig.value) {
        console.log('📄 Found unencrypted tokens, migrating...');
        const tokens: TokenData = {
          access_token: oldTokenConfig.value.access_token,
          refresh_token: oldTokenConfig.value.refresh_token,
          expires_in: oldTokenConfig.value.expires_in || 3600
        };
        await this.storeTokensInDatabase(tokens);
        this.refreshToken = tokens.refresh_token;
        this.accessToken = tokens.access_token;
        this.tokenExpiry = this.createSafeExpiryDate(tokens.expires_in);
        this.refreshTokenExpiry = this.createSafeExpiryDate(this.REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60);
        await this.configModel.deleteOne({ key: 'zoho_tokens' });
        console.log('✅ Token migration completed successfully');
      } else {
        console.log('ℹ️ No tokens found in database');
      }
    } catch (error) {
      console.error('❌ Error migrating tokens:', error);
    }
  }

  /**
   * Creates multiple Zoho contacts in a batch.
   * @param contacts Array of contact data to create.
   * @returns Object containing successful, failed, and duplicate contact results.
   */
  async createMultipleZohoContacts(contacts: ZohoContactData[]): Promise<{
    successful: string[];
    failed: { email: string; error: string }[];
    duplicates: string[];
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as { email: string; error: string }[],
      duplicates: [] as string[]
    };

    if (contacts.length === 0) {
      return results;
    }

    const validContacts = contacts.filter(contact => {
      if (!this.validateEmail(contact.email)) {
        results.failed.push({ email: contact.email, error: 'Invalid email format' });
        return false;
      }
      if (contact.phone && !this.validatePhone(contact.phone)) {
        results.failed.push({ email: contact.email, error: 'Invalid phone format' });
        return false;
      }
      return true;
    });

    if (validContacts.length === 0) {
      return results;
    }

    try {
      const accessToken = await this.getValidAccessToken();
      const zohoContactsPayload = {
        data: validContacts.map(contact => ({
          Email: contact.email,
          ...(contact.name && {
            First_Name: contact.name.split(' ')[0] || '',
            Last_Name: contact.name.split(' ').slice(1).join(' ') || contact.name
          }),
          ...(contact.phone && { Phone: contact.phone }),
          ...(contact.interests && contact.interests.length > 0 && {
            Description: `Interests: ${contact.interests.join(', ')}`
          }),
          Lead_Source: 'Newsletter',
          Newsletter_Subscription: true
        }))
      };

      console.log(`🔄 Creating ${validContacts.length} Zoho contacts in batch...`);

      const response = await this.withCircuitBreaker(async () => {
        return axios.post(
          `${this.zohoApiUrl}/crm/v2/Contacts`,
          zohoContactsPayload,
          {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json'
            },
            timeout: this.apiTimeout * 2
          }
        );
      }, 'batch_create_contacts');

      if (response.data?.data) {
        for (let index = 0; index < response.data.data.length; index++) {
          const result = response.data.data[index];
          const contact = validContacts[index];
          if (result.status === 'success' && result.details?.id) {
            results.successful.push(result.details.id);
            this.metrics.contactsCreated++;
          } else if (result.code === 'DUPLICATE_DATA') {
            const existingId = await this.findZohoContactByEmail(contact.email);
            if (existingId) {
              results.successful.push(existingId);
              this.metrics.contactsCreated++;
            } else {
              results.duplicates.push(contact.email);
            }
          } else {
            results.failed.push({
              email: contact.email,
              error: result.message || 'Unknown error'
            });
          }
        }
      }

      console.log(`✅ Batch contact creation completed: ${results.successful.length} successful, ${results.failed.length} failed, ${results.duplicates.length} duplicates`);

    } catch (error) {
      console.error('❌ Error in batch contact creation:', error.response?.data || error.message);
      validContacts.forEach(contact => {
        if (!results.failed.find(f => f.email === contact.email)) {
          results.failed.push({
            email: contact.email,
            error: error.response?.data?.message || error.message
          });
        }
      });
    }

    return results;
  }

  /**
   * Creates a single Zoho contact with validation and caching.
   * @param contactData Contact data to create.
   * @returns Contact ID.
   * @throws {HttpException} If contact creation fails or input is invalid.
   */
  async createZohoContact(contactData: ZohoContactData): Promise<string> {
    if (!this.validateEmail(contactData.email)) {
      throw new HttpException('Invalid email format', HttpStatus.BAD_REQUEST);
    }

    if (contactData.phone && !this.validatePhone(contactData.phone)) {
      throw new HttpException('Invalid phone number format', HttpStatus.BAD_REQUEST);
    }

    const cacheKey = `contact_${contactData.email}`;
    const cachedResult = this.getCacheEntry<string>(cacheKey);
    if (cachedResult) {
      console.log('✅ Found contact in cache:', contactData.email);
      return cachedResult;
    }

    try {
      const accessToken = await this.getValidAccessToken();
      const zohoContactPayload = {
        data: [
          {
            Email: contactData.email,
            ...(contactData.name && {
              First_Name: contactData.name.split(' ')[0] || '',
              Last_Name: contactData.name.split(' ').slice(1).join(' ') || contactData.name
            }),
            ...(contactData.phone && { Phone: contactData.phone }),
            ...(contactData.interests && contactData.interests.length > 0 && {
              Description: `Interests: ${contactData.interests.join(', ')}`
            }),
            Lead_Source: 'Newsletter',
            Newsletter_Subscription: true
          }
        ]
      };

      console.log('🔄 Creating Zoho contact:', contactData.email);

      const response = await this.withCircuitBreaker(async () => {
        return axios.post(
          `${this.zohoApiUrl}/crm/v2/Contacts`,
          zohoContactPayload,
          {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json'
            },
            timeout: this.apiTimeout
          }
        );
      }, 'create_contact');

      if (response.data?.data?.[0]?.details?.id) {
        const contactId = response.data.data[0].details.id;
        this.setCacheEntry(cacheKey, contactId);
        this.metrics.contactsCreated++;
        console.log('✅ Zoho contact created successfully:', contactId);
        return contactId;
      } else {
        throw new Error('No contact ID returned from Zoho');
      }

    } catch (error) {
      if (error.response?.data?.code === 'DUPLICATE_DATA') {
        try {
          const existingContact = await this.findZohoContactByEmail(contactData.email);
          if (existingContact) {
            this.setCacheEntry(cacheKey, existingContact);
            console.log('ℹ️ Contact already exists in Zoho:', existingContact);
            return existingContact;
          }
        } catch (findError) {
          console.warn('Could not find existing contact:', findError.message);
        }
        throw new HttpException('Contact already exists in Zoho CRM', HttpStatus.CONFLICT);
      }
      console.error('❌ Error creating Zoho contact:', error.response?.data || error.message);
      throw new HttpException(
        `Failed to create Zoho contact: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Gets the current service health and metrics.
   * @returns Service health information.
   */
  getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: ServiceMetrics;
    circuitBreaker: {
      isOpen: boolean;
      failures: number;
      nextRetryAt: Date | null;
    };
    tokenStatus: any;
    cacheStats: {
      entries: number;
      hitRate: string;
    };
  } {
    const now = new Date();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (this.circuitBreaker.isOpen) {
      status = 'unhealthy';
    } else if (
      this.circuitBreaker.failures > 0 ||
      (this.metrics.lastFailure && now.getTime() - this.metrics.lastFailure.getTime() < 300000)
    ) {
      status = 'degraded';
    }

    const totalCalls = this.metrics.apiCallsSuccessful + this.metrics.apiCallsFailed;
    const hitRate = totalCalls > 0
      ? ((this.metrics.apiCallsSuccessful / totalCalls) * 100).toFixed(2) + '%'
      : 'N/A';

    return {
      status,
      metrics: { ...this.metrics },
      circuitBreaker: {
        isOpen: this.circuitBreaker.isOpen,
        failures: this.circuitBreaker.failures,
        nextRetryAt: this.circuitBreaker.nextRetryAt
      },
      tokenStatus: this.getTokenStatus(),
      cacheStats: {
        entries: this.cache.size,
        hitRate
      }
    };
  }

  /**
   * Resets service state, clearing caches and metrics.
   */
  async resetService(): Promise<void> {
    console.log('🔄 Resetting Zoho service...');
    this.cache.clear();
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.lastFailure = null;
    this.circuitBreaker.nextRetryAt = null;
    this.resetRateLimit();
    const oldMetrics = { ...this.metrics };
    this.metrics = {
      tokensRefreshed: 0,
      apiCallsSuccessful: 0,
      apiCallsFailed: 0,
      lastSuccessfulCall: oldMetrics.lastSuccessfulCall,
      lastFailure: null,
      contactsCreated: 0,
      campaignsSent: 0
    };
    console.log('✅ Service reset completed');
  }

  /**
   * Cron job to check token expiry and auto-refresh.
   * Runs based on configured schedule (default: every 30 minutes).
   */
  @Cron(process.env.ZOHO_CRON_SCHEDULE || '0 */30 * * * *')
  async autoRefreshTokens(): Promise<void> {
    try {
      console.log('🔄 Running scheduled token check...');
      if (!this.isInitialized) {
        await this.initializeTokens();
      }
      if (!this.accessToken && !this.refreshToken) {
        console.log('ℹ️ No tokens available for auto-refresh');
        return;
      }
      const expiryInfo = this.getTokenExpiryInfo();
      if (this.shouldAutoRefreshAccessToken()) {
        console.log('🔄 Auto-refreshing access token...');
        try {
          await this.refreshAccessToken();
          console.log('✅ Access token auto-refreshed successfully');
        } catch (error) {
          console.error('❌ Failed to auto-refresh access token:', error.message);
          await this.notifyAdminOfTokenIssue('access_token_refresh_failed', error.message);
        }
      }
      if (expiryInfo.needsRenewal || expiryInfo.criticalExpiry) {
        await this.handleRefreshTokenExpiry(expiryInfo);
      }
    } catch (error) {
      console.error('❌ Error in auto-refresh cron job:', error);
    }
  }

  /**
   * Determines if the access token should be auto-refreshed.
   * @returns True if refresh is needed, false otherwise.
   */
  private shouldAutoRefreshAccessToken(): boolean {
    if (!this.accessToken || !this.refreshToken) return false;
    if (!this.tokenExpiry) return true;
    const now = new Date();
    const bufferTime = this.ACCESS_TOKEN_BUFFER_MINUTES * 60 * 1000;
    const refreshThreshold = new Date(this.tokenExpiry.getTime() - bufferTime);
    return now >= refreshThreshold;
  }

  /**
   * Handles refresh token expiry scenarios with admin notifications.
   * @param expiryInfo Token expiry information.
   */
  private async handleRefreshTokenExpiry(expiryInfo: TokenExpiryInfo): Promise<void> {
    const authUrl = this.getAuthorizationUrl();
    if (expiryInfo.criticalExpiry) {
      console.log('🚨 CRITICAL: Refresh token expires in less than 7 days!');
      await this.notifyAdminOfTokenIssue(
        'refresh_token_critical_expiry',
        `Refresh token expires in ${Math.ceil(expiryInfo.refreshTokenExpiresIn / (24 * 60 * 60))} days. Immediate action required.`,
        authUrl
      );
    } else if (expiryInfo.needsRenewal) {
      console.log('⚠️ WARNING: Refresh token expires in less than 30 days');
      await this.notifyAdminOfTokenIssue(
        'refresh_token_expiry_warning',
        `Refresh token expires in ${Math.ceil(expiryInfo.refreshTokenExpiresIn / (24 * 60 * 60))} days. Please renew soon.`,
        authUrl
      );
    }
  }

  /**
   * Gets comprehensive token expiry information.
   * @returns Token expiry details.
   */
  getTokenExpiryInfo(): TokenExpiryInfo {
    const now = new Date();
    let accessTokenExpiresIn = 0;
    let accessTokenExpiresAt: Date | null = null;
    if (this.tokenExpiry) {
      accessTokenExpiresAt = this.tokenExpiry;
      accessTokenExpiresIn = Math.max(0, Math.floor((this.tokenExpiry.getTime() - now.getTime()) / 1000));
    }
    let refreshTokenExpiresIn = 0;
    let refreshTokenExpiresAt: Date | null = null;
    if (this.refreshTokenExpiry) {
      refreshTokenExpiresAt = this.refreshTokenExpiry;
      refreshTokenExpiresIn = Math.max(0, Math.floor((this.refreshTokenExpiry.getTime() - now.getTime()) / 1000));
    }
    const refreshTokenDaysLeft = refreshTokenExpiresIn / (24 * 60 * 60);
    const needsRenewal = refreshTokenDaysLeft <= this.REFRESH_TOKEN_WARNING_DAYS && refreshTokenDaysLeft > this.CRITICAL_WARNING_DAYS;
    const criticalExpiry = refreshTokenDaysLeft <= this.CRITICAL_WARNING_DAYS;
    return {
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      needsRenewal,
      criticalExpiry
    };
  }

  /**
   * Notifies admin of token issues (stored in database for dashboard).
   * @param type Notification type.
   * @param message Notification message.
   * @param authUrl Optional authorization URL for re-authentication.
   */
  private async notifyAdminOfTokenIssue(type: string, message: string, authUrl?: string): Promise<void> {
    try {
      const notificationData = {
        type: 'zoho_oauth_issue',
        subtype: type,
        message,
        authUrl,
        timestamp: new Date(),
        severity: type.includes('critical') ? 'critical' : 'warning',
        resolved: false
      };
      console.log('📧 Admin notification:', notificationData);
      await this.configModel.updateOne(
        { key: `zoho_notification_${Date.now()}` },
        {
          key: `zoho_notification_${Date.now()}`,
          value: notificationData,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('❌ Failed to send admin notification:', error);
    }
  }

  /**
   * Generates the Zoho authorization URL.
   * @returns Authorization URL.
   */
  getAuthorizationUrl(): string {
    const scopes = [
      'ZohoCRM.modules.ALL',
      'ZohoCRM.settings.ALL',
      'ZohoCampaigns.campaign.ALL',
      'ZohoCampaigns.contact.ALL',
      'offline_access'
    ].join(',');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: scopes,
      redirect_uri: this.redirectUri,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${this.zohoAccountsUrl}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Provides instructions for admin to renew tokens.
   * @returns Authorization URL and renewal instructions.
   */
  getAdminRenewalInstructions(): {
    authUrl: string;
    instructions: string[];
    callbackInfo: string;
  } {
    const authUrl = this.getAuthorizationUrl();
    return {
      authUrl,
      instructions: [
        '1. Click on the authorization URL above',
        '2. Login to your Zoho account and grant permissions',
        '3. After approval, you will be redirected to the callback URL',
        '4. Copy the authorization code from the callback URL',
        '5. The code will be in the format: ?code=XXXXXXXX&location=in&accounts-server=...',
        '6. Use the /auth/zoho/callback endpoint or admin panel to submit the code'
      ],
      callbackInfo: `The callback URL is: ${this.redirectUri}`
    };
  }

  /**
   * Finds an existing Zoho contact by email.
   * @param email Email to search for.
   * @returns Contact ID or null if not found.
   */
  private async findZohoContactByEmail(email: string): Promise<string | null> {
    try {
      const accessToken = await this.getValidAccessToken();
      const response = await axios.get(
        `${this.zohoApiUrl}/crm/v2/Contacts/search`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`
          },
          params: {
            criteria: `Email:equals:${email}`
          },
          timeout: 30000
        }
      );
      if (response.data?.data?.[0]?.id) {
        return response.data.data[0].id;
      }
      return null;
    } catch (error) {
      console.error('Error finding contact by email:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Sends a campaign via Zoho Campaigns.
   * @param campaignData Campaign data to send.
   * @returns Campaign ID.
   * @throws {HttpException} If campaign creation fails.
   */
  async sendZohoCampaign(campaignData: ZohoCampaignData): Promise<string> {
    try {
      const accessToken = await this.getValidAccessToken();
      const mailingListId = await this.createOrGetMailingList('Newsletter Subscribers');
      await this.addRecipientsToMailingList(mailingListId, campaignData.recipientEmails);
      const campaignPayload = {
        campaign_name: `Newsletter Campaign - ${new Date().toISOString().split('T')[0]}`,
        subject: campaignData.subject,
        from_email: process.env.ZOHO_FROM_EMAIL || 'noreply@yourdomain.com',
        from_name: process.env.ZOHO_FROM_NAME || 'Newsletter',
        reply_to: process.env.ZOHO_REPLY_TO || 'noreply@yourdomain.com',
        content: campaignData.content,
        list_keys: [mailingListId],
        send_option: 'SendNow'
      };

      console.log('🔄 Creating Zoho campaign...');

      const response = await axios.post(
        `${this.zohoApiUrl}/campaigns/v1/createandsendcampaign`,
        campaignPayload,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      if (response.data?.campaign_key) {
        const campaignId = response.data.campaign_key;
        console.log('✅ Zoho campaign sent successfully:', campaignId);
        return campaignId;
      } else {
        throw new Error('No campaign ID returned from Zoho');
      }

    } catch (error) {
      console.error('❌ Error sending Zoho campaign:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        throw new HttpException('Zoho authorization failed. Please re-authorize.', HttpStatus.UNAUTHORIZED);
      }
      throw new HttpException(
        `Failed to send Zoho campaign: ${error.response?.data?.message || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Creates or gets an existing mailing list.
   * @param listName Name of the mailing list.
   * @returns Mailing list ID.
   * @throws {Error} If mailing list creation fails.
   */
  private async createOrGetMailingList(listName: string): Promise<string> {
    try {
      const accessToken = await this.getValidAccessToken();
      const existingListResponse = await axios.get(
        `${this.zohoApiUrl}/campaigns/v1/getmailinglists`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`
          },
          timeout: 30000
        }
      );

      if (existingListResponse.data?.list_of_details) {
        const existingList = existingListResponse.data.list_of_details.find(
          (list: any) => list.listname === listName
        );
        if (existingList?.listkey) {
          console.log('✅ Using existing mailing list:', existingList.listkey);
          return existingList.listkey;
        }
      }

      console.log('🔄 Creating new mailing list:', listName);
      const createListResponse = await axios.post(
        `${this.zohoApiUrl}/campaigns/v1/createmailinglist`,
        {
          listname: listName,
          description: 'Automatically created mailing list for newsletter subscribers'
        },
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (createListResponse.data?.list_key) {
        console.log('✅ Mailing list created:', createListResponse.data.list_key);
        return createListResponse.data.list_key;
      } else {
        throw new Error('No list key returned from Zoho');
      }

    } catch (error) {
      console.error('❌ Error with mailing list:', error.response?.data || error.message);
      throw new Error(`Failed to create/get mailing list: ${error.message}`);
    }
  }

  /**
   * Adds recipients to a mailing list.
   * @param listId Mailing list ID.
   * @param emails Array of email addresses.
   */
  private async addRecipientsToMailingList(listId: string, emails: string[]): Promise<void> {
    try {
      const accessToken = await this.getValidAccessToken();
      const contactData = emails.map(email => ({
        'Contact Email': email,
        'Contact Name': email.split('@')[0]
      }));

      console.log(`🔄 Adding ${emails.length} recipients to mailing list...`);

      const response = await axios.post(
        `${this.zohoApiUrl}/campaigns/v1/contacts/${listId}/addcontacts`,
        {
          contact_info: contactData
        },
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      console.log('✅ Recipients added to mailing list successfully');

    } catch (error) {
      console.error('❌ Error adding recipients to mailing list:', error.response?.data || error.message);
      console.warn('Continuing with existing mailing list contacts...');
    }
  }

  /**
   * Creates a valid date from a timestamp.
   * @param timestamp Optional timestamp to convert.
   * @returns Valid Date object or null if invalid.
   */
  private createValidDate(timestamp?: number | string | Date): Date | null {
    if (!timestamp) return null;
    try {
      let date: Date;
      if (typeof timestamp === 'number') {
        const ms = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
        date = new Date(ms);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (timestamp instanceof Date) {
        date = new Date(timestamp.getTime());
      } else {
        console.warn('Unknown timestamp type:', typeof timestamp, timestamp);
        return null;
      }
      if (isNaN(date.getTime())) {
        console.warn('Invalid date created from:', timestamp);
        return null;
      }
      return date;
    } catch (error) {
      console.error('Error creating date from timestamp:', timestamp, error);
      return null;
    }
  }

  /**
   * Creates a safe expiry date.
   * @param expiresIn Expiry duration in seconds.
   * @returns Date object for expiry.
   */
  private createSafeExpiryDate(expiresIn: number): Date {
    try {
      const now = Date.now();
      const expiryTime = now + (expiresIn * 1000);
      const date = new Date(expiryTime);
      if (isNaN(date.getTime())) {
        console.warn('Invalid expiry date created, using default 1 hour');
        return new Date(Date.now() + 3600 * 1000);
      }
      return date;
    } catch (error) {
      console.error('Error creating expiry date, using default:', error);
      return new Date(Date.now() + 3600 * 1000);
    }
  }

  /**
   * Initializes tokens from environment variables or database.
   */
  private async initializeTokens(): Promise<void> {
    if (this.isInitialized) return;
    console.log('🔄 Initializing Zoho tokens...');
    try {
      const envAccessToken = process.env.ZOHO_ACCESS_TOKEN;
      const envRefreshToken = process.env.ZOHO_REFRESH_TOKEN;
      if (envAccessToken && envRefreshToken) {
        console.log('✅ Found tokens in environment variables');
        this.accessToken = envAccessToken;
        this.refreshToken = envRefreshToken;
        this.tokenExpiry = this.createSafeExpiryDate(3600);
        this.refreshTokenExpiry = this.createSafeExpiryDate(this.REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60);
        await this.storeTokensInDatabase({
          access_token: envAccessToken,
          refresh_token: envRefreshToken,
          expires_in: 3600
        });
        this.isInitialized = true;
        return;
      }
      await this.loadTokensFromDatabase();
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Error initializing tokens:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Exchanges authorization code for tokens.
   * @param authorizationCode OAuth authorization code.
   * @returns Token data.
   * @throws {HttpException} If token exchange fails.
   */
  async exchangeCodeForTokens(authorizationCode: string): Promise<TokenData> {
    try {
      const response = await axios.post(
        `${this.zohoAccountsUrl}/oauth/v2/token`,
        {
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code: authorizationCode,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000
        }
      );
      console.log('✅ Successfully exchanged code for tokens');
      const { access_token, refresh_token, expires_in } = response.data;
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.tokenExpiry = this.createSafeExpiryDate(expires_in);
      this.refreshTokenExpiry = this.createSafeExpiryDate(this.REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60);
      this.resetRateLimit();
      await this.storeTokensInDatabase({
        access_token,
        refresh_token,
        expires_in
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error.response?.data || error.message);
      throw new HttpException(
        `Failed to exchange authorization code for tokens: ${error.response?.data?.error || error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Sets a configuration value in the database.
   * @param key Config key.
   * @param value Config value.
   * @param expiresAt Optional expiry date.
   */
  async setConfigValue(key: string, value: any, expiresAt?: Date): Promise<void> {
    try {
      const updateData: any = {
        key,
        value,
        updatedAt: new Date()
      };
      if (expiresAt) {
        updateData.expires_at = expiresAt;
      }
      await this.configModel.updateOne(
        { key },
        updateData,
        { upsert: true }
      );
      console.log(`✅ Config value set: ${key}`);
    } catch (error) {
      console.error(`❌ Error setting config value ${key}:`, error);
      throw new HttpException(
        `Failed to set config value: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Gets a configuration value from the database.
   * @param key Config key.
   * @returns Config value or null if not found or expired.
   */
  async getConfigValue(key: string): Promise<any> {
    try {
      const config = await this.configModel.findOne({ key });
      if (!config) {
        return null;
      }
      if (config.expires_at && config.expires_at <= new Date()) {
        console.log(`⚠️ Config ${key} has expired, returning null`);
        return null;
      }
      return config.value;
    } catch (error) {
      console.error(`❌ Error getting config value ${key}:`, error);
      return null;
    }
  }

  /**
   * Clears all Zoho tokens from memory and database.
   */
  async clearTokens(): Promise<void> {
    try {
      console.log('🔄 Clearing Zoho tokens...');
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      this.refreshTokenExpiry = null;
      this.isInitialized = false;
      this.resetRateLimit();
      await this.configModel.deleteMany({
        key: {
          $in: [
            'zoho_tokens',
            'ZOHO_ACCESS_TOKEN',
            'ZOHO_REFRESH_TOKEN',
            'ZOHO_REFRESH_TOKEN_EXPIRY'
          ]
        }
      });
      console.log('✅ Zoho tokens cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing tokens:', error);
      throw new HttpException(
        `Failed to clear tokens: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Deletes a specific configuration value.
   * @param key Config key to delete.
   * @returns True if deleted, false otherwise.
   */
  async deleteConfigValue(key: string): Promise<boolean> {
    try {
      const result = await this.configModel.deleteOne({ key });
      console.log(`✅ Config value deleted: ${key}`);
      return result.deletedCount > 0;
    } catch (error) {
      console.error(`❌ Error deleting config value ${key}:`, error);
      throw new HttpException(
        `Failed to delete config value: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Gets the current token status.
   * @returns Token status information.
   */
  getTokenStatus(): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    accessTokenExpired: boolean;
    refreshTokenExpired: boolean;
    isInitialized: boolean;
    lastRefreshAttempt: Date;
    consecutiveFailures: number;
    inBackoffPeriod: boolean;
  } {
    const now = new Date();
    return {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      accessTokenExpired: this.isTokenExpired(),
      refreshTokenExpired: this.refreshTokenExpiry ? this.refreshTokenExpiry <= now : false,
      isInitialized: this.isInitialized,
      lastRefreshAttempt: this.rateLimitTracker.lastRefreshAttempt,
      consecutiveFailures: this.rateLimitTracker.consecutiveFailures,
      inBackoffPeriod: this.isInBackoffPeriod()
    };
  }

  /**
   * Refreshes the access token using the refresh token.
   * @returns New access token.
   * @throws {HttpException} If refresh fails or is rate-limited.
   */
  async refreshAccessToken(): Promise<string> {
    if (this.isInBackoffPeriod()) {
      throw new HttpException(
        'Rate limited. Please wait before retrying.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (!this.canAttemptRefresh()) {
      throw new HttpException(
        'Too many refresh attempts. Please wait before retrying.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (!this.refreshToken) {
      await this.notifyAdminOfTokenIssue(
        'no_refresh_token',
        'No refresh token available. Complete re-authorization required.',
        this.getAuthorizationUrl()
      );
      throw new HttpException(
        'No refresh token available. Please re-authorize.',
        HttpStatus.UNAUTHORIZED
      );
    }

    if (this.refreshTokenExpiry && this.refreshTokenExpiry <= new Date()) {
      await this.notifyAdminOfTokenIssue(
        'refresh_token_expired',
        'Refresh token has expired. Complete re-authorization required.',
        this.getAuthorizationUrl()
      );
      throw new HttpException(
        'Refresh token has expired. Please re-authorize.',
        HttpStatus.UNAUTHORIZED
      );
    }

    if (this.rateLimitTracker.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.handleRateLimit();
      throw new HttpException(
        'Too many consecutive failures. Please re-authorize.',
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      console.log('🔄 Refreshing access token...');
      this.rateLimitTracker.lastRefreshAttempt = new Date();
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('client_id', this.clientId);
      formData.append('client_secret', this.clientSecret);
      formData.append('refresh_token', this.refreshToken);

      const response = await axios.post(
        `${this.zohoAccountsUrl}/oauth/v2/token`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000
        }
      );

      console.log('✅ Token refreshed successfully');
      const { access_token, expires_in } = response.data;
      this.accessToken = access_token;
      this.tokenExpiry = this.createSafeExpiryDate(expires_in);
      this.resetRateLimit();
      await this.storeTokensInDatabase({
        access_token,
        refresh_token: this.refreshToken,
        expires_in
      });
      return access_token;
    } catch (error) {
      console.error('❌ Error refreshing access token:', error.response?.data || error.message);
      if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
        await this.notifyAdminOfTokenIssue(
          'invalid_refresh_token',
          'Refresh token is invalid or expired. Complete re-authorization required.',
          this.getAuthorizationUrl()
        );
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.refreshTokenExpiry = null;
        throw new HttpException(
          'Invalid refresh token. Please re-authorize.',
          HttpStatus.UNAUTHORIZED
        );
      }
      if (
        error.response?.data?.error === 'Access Denied' &&
        error.response?.data?.error_description?.includes('too many requests')
      ) {
        this.handleRateLimit();
        throw new HttpException(
          'Rate limited by Zoho. Please wait before retrying or re-authorize.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      this.rateLimitTracker.consecutiveFailures++;
      throw new HttpException(
        `Failed to refresh access token: ${error.response?.data?.error || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private isInBackoffPeriod(): boolean {
    if (!this.rateLimitTracker.backoffUntil) return false;
    const now = new Date();
    if (now < this.rateLimitTracker.backoffUntil) {
      const remainingMs = this.rateLimitTracker.backoffUntil.getTime() - now.getTime();
      console.log(`🚫 Still in backoff period for ${Math.ceil(remainingMs / 1000)} seconds`);
      return true;
    }
    this.rateLimitTracker.backoffUntil = null;
    this.rateLimitTracker.consecutiveFailures = 0;
    return false;
  }

  private calculateBackoffDuration(): number {
    const multiplier = Math.pow(2, this.rateLimitTracker.consecutiveFailures - 1);
    const backoffMs = Math.min(this.BASE_BACKOFF_MS * multiplier, this.MAX_BACKOFF_MS);
    return backoffMs;
  }

  private handleRateLimit(): void {
    this.rateLimitTracker.consecutiveFailures++;
    const backoffMs = this.calculateBackoffDuration();
    this.rateLimitTracker.backoffUntil = new Date(Date.now() + backoffMs);
    console.error(`🚫 Rate limited! Backing off for ${Math.ceil(backoffMs / 1000)} seconds. Failure count: ${this.rateLimitTracker.consecutiveFailures}`);
  }

  private resetRateLimit(): void {
    this.rateLimitTracker.consecutiveFailures = 0;
    this.rateLimitTracker.backoffUntil = null;
  }

  private canAttemptRefresh(): boolean {
    const now = new Date();
    const timeSinceLastAttempt = now.getTime() - this.rateLimitTracker.lastRefreshAttempt.getTime();
    if (timeSinceLastAttempt < this.MIN_REFRESH_INTERVAL) {
      console.log(`⏳ Must wait ${Math.ceil((this.MIN_REFRESH_INTERVAL - timeSinceLastAttempt) / 1000)} seconds before next refresh attempt`);
      return false;
    }
    return true;
  }

  /**
   * Gets a valid access token, refreshing if necessary.
   * @returns Valid access token.
   * @throws {HttpException} If no valid token is available.
   */
  async getValidAccessToken(): Promise<string> {
    if (!this.isInitialized) {
      await this.initializeTokens();
    }
    if (!this.accessToken) {
      await this.loadTokensFromDatabase();
    }
    if (!this.accessToken && !this.refreshToken) {
      throw new HttpException(
        'No valid tokens available. Please complete OAuth authorization first.',
        HttpStatus.UNAUTHORIZED
      );
    }
    const isExpired = this.isTokenExpired();
    console.log(`🔍 Current token status: {
  hasAccessToken: ${!!this.accessToken},
  hasRefreshToken: ${!!this.refreshToken},
  isExpired: ${isExpired},
  expiresAt: '${this.tokenExpiry?.toISOString() || 'null'}',
  refreshExpiresAt: '${this.refreshTokenExpiry?.toISOString() || 'null'}'
}`);
    if (this.accessToken && !isExpired) {
      console.log('✅ Using existing valid access token');
      return this.accessToken;
    }
    if (this.refreshToken) {
      console.log('🔄 Access token expired/missing, refreshing...');
      try {
        return await this.refreshAccessToken();
      } catch (refreshError) {
        console.error('❌ Failed to refresh token:', refreshError.message);
        throw refreshError;
      }
    }
    throw new HttpException(
      'No valid tokens available. Please complete OAuth authorization first.',
      HttpStatus.UNAUTHORIZED
    );
  }

  /**
   * Checks if the current access token is expired.
   * @returns True if expired, false otherwise.
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) {
      console.log('⚠️ No token expiry time available, assuming expired');
      return true;
    }
    try {
      if (!(this.tokenExpiry instanceof Date) || isNaN(this.tokenExpiry.getTime())) {
        console.log('⚠️ Invalid token expiry date, assuming expired');
        return true;
      }
      const bufferTime = 5 * 60 * 1000;
      const now = new Date();
      const expiryWithBuffer = new Date(this.tokenExpiry.getTime() - bufferTime);
      const expired = now >= expiryWithBuffer;
      console.log(`Token expiry check: now=${now.toISOString()}, expires=${this.tokenExpiry.toISOString()}, expired=${expired}`);
      return expired;
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  }

  /**
   * Gets all configuration values from the database.
   * @returns Array of configuration objects.
   */
  async getAllConfigValues(): Promise<Config[]> {
    return this.configModel.find({}).select('key expires_at createdAt updatedAt').exec();
  }
}