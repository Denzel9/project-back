import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { AnalyticsProviderInterface, SocialMediaMetrics } from '../analytics.types';

@Injectable()
export class TelegramAnalyticsProvider implements AnalyticsProviderInterface {
  private readonly logger = new Logger(TelegramAnalyticsProvider.name);
  private readonly botToken: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  }

  getPlatform(): Platform {
    return Platform.TELEGRAM;
  }

  isConfigured(): boolean {
    return !!this.botToken;
  }

  async fetchMetrics(postUrl: string, accessToken?: string): Promise<SocialMediaMetrics> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot Token не настроен');
    }

    try {
      // Парсинг URL: https://t.me/channel_name/message_id
      const urlMatch = postUrl.match(/t\.me\/([^\/]+)\/(\d+)/);
      if (!urlMatch) {
        throw new Error('Некорректный URL Telegram поста');
      }

      const [, channelUsername, messageId] = urlMatch;

      // Получаем информацию о посте через Telegram Bot API
      // Note: Bot должен быть админом канала для получения статистики
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/getChat?chat_id=@${channelUsername}`
      );

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }

      const chatData = await response.json();

      // Telegram Bot API ограничен в метриках, но можем получить базовые данные
      return {
        views: 0, // Telegram Bot API не предоставляет просмотры без admin прав
        reach: chatData.result?.member_count || 0,
        extraMetrics: {
          channelTitle: chatData.result?.title,
          channelUsername: chatData.result?.username,
          memberCount: chatData.result?.member_count,
        },
      };
    } catch (error) {
      this.logger.error(
        `Ошибка получения метрик Telegram: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }
}
