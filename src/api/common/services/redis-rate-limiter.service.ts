
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisRateLimiterService {
  private readonly logger = new Logger(RedisRateLimiterService.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
    blockDurationMs?: number
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    isBlocked?: boolean;
  }> {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const redisKey = `rate_limit:${key}:${window}`;
    const blockKey = `blocked:${key}`;

    try {
      // Check if IP is currently blocked
      if (blockDurationMs) {
        const isBlocked = await this.redis.get(blockKey);
        if (isBlocked) {
          const ttl = await this.redis.ttl(blockKey);
          return {
            allowed: false,
            remaining: 0,
            resetTime: now + (ttl * 1000),
            isBlocked: true
          };
        }
      }

      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      if (!results) throw new Error('Redis pipeline execution failed');
      const currentCount = results[0][1] as number;

      if (currentCount > limit) {
        // If blocking is enabled, block the key
        if (blockDurationMs) {
          await this.redis.setex(blockKey, Math.ceil(blockDurationMs / 1000), 'blocked');
        }

        return {
          allowed: false,
          remaining: 0,
          resetTime: (window + 1) * windowMs,
          isBlocked: Boolean(blockDurationMs)
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, limit - currentCount),
        resetTime: (window + 1) * windowMs,
        isBlocked: false
      };
    } catch (error) {
      this.logger.error('Rate limiting check failed:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: limit,
        resetTime: now + windowMs,
        isBlocked: false
      };
    }
  }

  async resetRateLimit(key: string): Promise<void> {
    try {
      const pattern = `rate_limit:${key}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error('Failed to reset rate limit:', error);
    }
  }

  async blockKey(key: string, durationMs: number): Promise<void> {
    try {
      const blockKey = `blocked:${key}`;
      await this.redis.setex(blockKey, Math.ceil(durationMs / 1000), 'blocked');
    } catch (error) {
      this.logger.error('Failed to block key:', error);
    }
  }

  async unblockKey(key: string): Promise<void> {
    try {
      const blockKey = `blocked:${key}`;
      await this.redis.del(blockKey);
    } catch (error) {
      this.logger.error('Failed to unblock key:', error);
    }
  }
}