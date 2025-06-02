
// common/middleware/global-rate-limit.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisRateLimiterService } from '../services/redis-rate-limiter.service';

@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GlobalRateLimitMiddleware.name);

  constructor(private rateLimiter: RedisRateLimiterService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const key = `global:${req.ip}`;
    
    const result = await this.rateLimiter.checkRateLimit(
      key,
      200, // 200 requests
      60 * 1000, // per minute
    );

    res.set({
      'X-RateLimit-Limit': '200',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    });

    if (!result.allowed) {
      this.logger.warn(`Global rate limit exceeded for IP: ${req.ip}`);
      return res.status(429).json({
        statusCode: 429,
        message: 'Too many requests',
        error: 'Too Many Requests',
      });
    }

    next();
  }
}