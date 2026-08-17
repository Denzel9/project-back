import { applyDecorators, UseGuards } from '@nestjs/common';
import { seconds, Throttle, ThrottlerGuard } from '@nestjs/throttler';

/** Rate limit for login / register / refresh / password recovery. */
export function ThrottleAuth(limit = 10, ttlSeconds = 60) {
  return applyDecorators(
    Throttle({ auth: { limit, ttl: seconds(ttlSeconds) } }),
    UseGuards(ThrottlerGuard)
  );
}

/** Rate limit for media upload. */
export function ThrottleUpload(limit = 100, ttlSeconds = 60) {
  return applyDecorators(
    Throttle({ upload: { limit, ttl: seconds(ttlSeconds) } }),
    UseGuards(ThrottlerGuard)
  );
}
