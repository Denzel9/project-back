import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';

export function getRedisUrl(configService: ConfigService): string {
  return (
    configService.get<string>('REDIS_URL')?.trim() || 'redis://localhost:6379'
  );
}

/** Connection options shared by BullMQ queues/workers and ioredis. */
export function getBullMqConnection(
  configService: ConfigService
): ConnectionOptions {
  const url = new URL(getRedisUrl(configService));

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}
