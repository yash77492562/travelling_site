import { Global, Module } from '@nestjs/common';
import { RedisRateLimiterService } from './services/redis-rate-limiter.service';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Global() // Makes this module globally available
@Module({
  providers: [
    RedisRateLimiterService,
    RateLimitGuard,
  ],
  exports: [
    RedisRateLimiterService,
    RateLimitGuard,
  ],
})
export class CommonModule {}