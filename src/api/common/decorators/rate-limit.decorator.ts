
// common/decorators/rate-limit.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { RateLimitOptions } from '../guards/rate-limit.guard';

export const RateLimit = (options: RateLimitOptions) => 
  SetMetadata('rateLimitOptions', options);

// Predefined rate limiting configurations
export const LoginRateLimit = () => RateLimit({
  limit: 5, // 5 attempts
  // windowMs: 15 * 60 * 1000, // 15 minutes
  // blockDurationMs: 60 * 60 * 1000, // Block for 1 hour after exceeding limit
  windowMs: 1000,              // Optional: 1 minute window (instead of 15 mins for faster testing)
  blockDurationMs: 1000,        // 5 seconds block duration
  message: 'Too many login attempts. Please try again later.',
  keyGenerator: (req) => `login:${req.ip}:${req.body?.email || 'unknown'}`,
});

export const RegisterRateLimit = () => RateLimit({
  limit: 3, // 3 registrations
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many registration attempts. Please try again later.',
});

export const ForgotPasswordRateLimit = () => RateLimit({
  limit: 3, // 3 attempts
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many password reset attempts. Please try again later.',
  keyGenerator: (req) => `forgot_password:${req.ip}:${req.body?.email || 'unknown'}`,
});

export const StrictRateLimit = () => RateLimit({
  limit: 10,
  // windowMs: 60 * 1000, // 1 minute
  // blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
  windowMs: 1000,              // Optional: 1 minute window (instead of 15 mins for faster testing)
  blockDurationMs: 1000,        // 5 seconds block duration
  message: 'Rate limit exceeded. Please slow down.',
});