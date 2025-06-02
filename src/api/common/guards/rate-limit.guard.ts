
// common/guards/rate-limit.guard.ts
import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  HttpException, 
  HttpStatus,
  Logger 
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisRateLimiterService } from '../services/redis-rate-limiter.service';

export interface RateLimitOptions {
  keyGenerator?: (req: any) => string;
  limit: number;
  windowMs: number;
  blockDurationMs?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private rateLimiter: RedisRateLimiterService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get rate limit configuration from decorator
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      'rateLimitOptions',
      context.getHandler(),
    );

    if (!rateLimitOptions) {
      return true; // No rate limiting configured
    }

    // Generate rate limiting key
    const key = rateLimitOptions.keyGenerator 
      ? rateLimitOptions.keyGenerator(request)
      : this.getDefaultKey(request);

    // Check rate limit
    const result = await this.rateLimiter.checkRateLimit(
      key,
      rateLimitOptions.limit,
      rateLimitOptions.windowMs,
      rateLimitOptions.blockDurationMs,
    );

    // Set rate limit headers
    response.set({
      'X-RateLimit-Limit': rateLimitOptions.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    });

    if (!result.allowed) {
      const message = result.isBlocked 
        ? 'IP temporarily blocked due to too many requests'
        : (rateLimitOptions.message || 'Too many requests');

      // Log the rate limit violation
      this.logger.warn(`Rate limit exceeded for key: ${key}`, {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        endpoint: `${request.method} ${request.url}`,
        isBlocked: result.isBlocked,
      });

      if (result.isBlocked) {
        response.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString());
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message,
          error: 'Too Many Requests',
          retryAfter: result.resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getDefaultKey(request: any): string {
    // Combine IP and User-Agent for better uniqueness
    const ip = request.ip || request.connection.remoteAddress;
    const userAgent = request.get('User-Agent') || 'unknown';
    const endpoint = `${request.method}:${request.route?.path || request.url}`;
    
    return `${ip}:${this.hashString(userAgent)}:${endpoint}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}