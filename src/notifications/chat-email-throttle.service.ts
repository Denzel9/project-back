import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
 * In-memory throttle для email по чату.
 * Первое письмо в окне уходит сразу; дальше копятся pending;
 * после истечения окна — одно письмо с messageCount (дайджест).
 */
@Injectable()
export class ChatEmailThrottleService {
  private readonly entries = new Map<string, ThrottleEntry>();
  private readonly windowMs: number;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('CHAT_EMAIL_THROTTLE_MS');
    const parsed = configured !== undefined ? Number(configured) : NaN;
    this.windowMs =
      Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 60 * 1000;
  }

  decide(recipientId: string, conversationId: string): ChatEmailThrottleDecision {
    const key = this.key(recipientId, conversationId);
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

  private key(recipientId: string, conversationId: string): string {
    return `${recipientId}:${conversationId}`;
  }
}
