import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { AnalyticsProviderInterface, SocialMediaMetrics } from '../analytics.types';

@Injectable()
export class VKAnalyticsProvider implements AnalyticsProviderInterface {
  private readonly logger = new Logger(VKAnalyticsProvider.name);
  private readonly apiVersion = '5.131';

  getPlatform(): Platform {
    return Platform.VK;
  }

  isConfigured(): boolean {
    return true; // VK API доступен публично для некоторых метрик
  }

  async fetchMetrics(postUrl: string, accessToken?: string): Promise<SocialMediaMetrics> {
    try {
      // Парсинг URL: https://vk.com/wall-123456_789
      const urlMatch = postUrl.match(/vk\.com\/wall(-?\d+)_(\d+)/);
      if (!urlMatch) {
        throw new Error('Некорректный URL VK поста');
      }

      const [, ownerId, postId] = urlMatch;

      if (!accessToken) {
        this.logger.warn('Access token не предоставлен, используем публичные метрики');
        return this.fetchPublicMetrics(ownerId, postId);
      }

      // Получаем детальную статистику с токеном
      return this.fetchDetailedMetrics(ownerId, postId, accessToken);
    } catch (error) {
      this.logger.error(
        `Ошибка получения метрик VK: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  private async fetchPublicMetrics(ownerId: string, postId: string): Promise<SocialMediaMetrics> {
    const response = await fetch(
      `https://api.vk.com/method/wall.getById?` +
      `posts=${ownerId}_${postId}&v=${this.apiVersion}`
    );

    if (!response.ok) {
      throw new Error(`VK API error: ${response.statusText}`);
    }

    const data = await response.json();
    const post = data.response?.items?.[0];

    if (!post) {
      return {};
    }

    return {
      views: post.views?.count || 0,
      likes: post.likes?.count || 0,
      comments: post.comments?.count || 0,
      shares: post.reposts?.count || 0,
      extraMetrics: {
        postType: post.post_type,
        attachments: post.attachments?.length || 0,
      },
    };
  }

  private async fetchDetailedMetrics(
    ownerId: string,
    postId: string,
    accessToken: string
  ): Promise<SocialMediaMetrics> {
    // Получаем базовые метрики
    const basicMetrics = await this.fetchPublicMetrics(ownerId, postId);

    // Получаем статистику для community (требует прав администратора)
    try {
      const statsResponse = await fetch(
        `https://api.vk.com/method/stats.getPostReach?` +
        `owner_id=${ownerId}&post_ids=${postId}&access_token=${accessToken}&v=${this.apiVersion}`
      );

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        const stats = statsData.response?.[0];

        if (stats) {
          return {
            ...basicMetrics,
            reach: stats.reach_total || basicMetrics.views,
            impressions: stats.reach_ads || 0,
            linkClicks: stats.links || 0,
            extraMetrics: {
              ...basicMetrics.extraMetrics,
              reachSubscribers: stats.reach_subscribers,
              reachTotal: stats.reach_total,
              toGroup: stats.to_group,
              joinGroup: stats.join_group,
            },
          };
        }
      }
    } catch (error) {
      this.logger.warn('Не удалось получить детальную статистику VK');
    }

    return basicMetrics;
  }
}
