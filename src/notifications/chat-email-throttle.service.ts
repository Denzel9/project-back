import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

type ThrottleEntry = {
  lastSentAt: number;
  pendingCount: number;
};

export type ChatEmailThrottleDecision =
  | { send: false }
  | {
      send: true;
      /** Сколько сообщений покрывает это письмо (1 = только текущее). */
      messageCount: number;
    };

/**
 * Throttle email по чату: первое письмо в окне сразу, дальше pending,
 * после окна — одно письмо с messageCount (дайджест).
 * Redis — для multi-instance; fallback — in-memory Map.
 */
@Injectable()
export class ChatEmailThrottleService {
  private readonly logger = new Logger(ChatEmailThrottleService.name);
  private readonly entries = new Map<string, ThrottleEntry>();
  private readonly windowMs: number;

  private static readonly LUA = `
local lastKey = KEYS[1]
local pendingKey = KEYS[2]
local windowMs = tonumber(ARGV[1])
local now = tonumber(ARGV[2])

local last = redis.call('GET', lastKey)
if last and (now - tonumber(last)) < windowMs then
  local pending = redis.call('INCR', pendingKey)
  redis.call('PEXPIRE', pendingKey, windowMs * 2)
  return {0, pending}
end

local pending = tonumber(redis.call('GET', pendingKey) or '0')
redis.call('DEL', pendingKey)
redis.call('SET', lastKey, tostring(now))
redis.call('PEXPIRE', lastKey, windowMs * 2)
return {1, pending + 1}
`;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null
  ) {
    const configured = this.configService.get<string>('CHAT_EMAIL_THROTTLE_MS');
    const parsed = configured !== undefined ? Number(configured) : NaN;
    this.windowMs =
      Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 60 * 1000;

    if (!this.redis) {
      this.logger.warn(
        'Redis недоступен — chat email throttle использует in-memory Map'
      );
    }
  }

  async decide(
    recipientId: string,
    conversationId: string
  ): Promise<ChatEmailThrottleDecision> {
    if (this.redis) {
      try {
        return await this.decideRedis(recipientId, conversationId);
      } catch (error) {
        this.logger.warn(
          `Redis throttle failed, fallback to memory: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return this.decideMemory(recipientId, conversationId);
  }

  private async decideRedis(
    recipientId: string,
    conversationId: string
  ): Promise<ChatEmailThrottleDecision> {
    const lastKey = `chat-email:last:${recipientId}:${conversationId}`;
    const pendingKey = `chat-email:pending:${recipientId}:${conversationId}`;
    const now = Date.now();

    const result = (await this.redis!.eval(
      ChatEmailThrottleService.LUA,
      2,
      lastKey,
      pendingKey,
      this.windowMs,
      now
    )) as [number | string, number | string];

    const send = Number(result[0]) === 1;
    const messageCount = Number(result[1]);

    if (!send) {
      return { send: false };
    }

    return { send: true, messageCount };
  }

  private decideMemory(
    recipientId: string,
    conversationId: string
  ): ChatEmailThrottleDecision {
    const key = `${recipientId}:${conversationId}`;
    const now = Date.now();
    const entry = this.entries.get(key);

    if (entry && now - entry.lastSentAt < this.windowMs) {
      entry.pendingCount += 1;
      this.entries.set(key, entry);
      return { send: false };
    }

    const messageCount = (entry?.pendingCount ?? 0) + 1;
    this.entries.set(key, { lastSentAt: now, pendingCount: 0 });
    return { send: true, messageCount };
  }
}
