import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { AnalyticsProviderInterface, SocialMediaMetrics } from '../analytics.types';

@Injectable()
export class InstagramAnalyticsProvider implements AnalyticsProviderInterface {
  private readonly logger = new Logger(InstagramAnalyticsProvider.name);

  getPlatform(): Platform {
    return Platform.INSTAGRAM;
  }

  isConfigured(): boolean {
    return true;
  }

  async fetchMetrics(postUrl: string, accessToken?: string): Promise<SocialMediaMetrics> {
    if (!accessToken) {
      throw new Error('Instagram требует access token для получения метрик');
    }

    try {
      // Парсинг media ID из URL или использование прямого ID
      const mediaId = this.extractMediaId(postUrl);

      // Instagram Graph API
      const insightsResponse = await fetch(
        `https://graph.facebook.com/v21.0/${mediaId}/insights?` +
        `metric=engagement,impressions,reach,saved,video_views&access_token=${accessToken}`
      );

      if (!insightsResponse.ok) {
        throw new Error(`Instagram API error: ${insightsResponse.statusText}`);
      }

      const insightsData = await insightsResponse.json();

      // Получаем базовую информацию о посте
      const mediaResponse = await fetch(
        `https://graph.facebook.com/v21.0/${mediaId}?` +
        `fields=like_count,comments_count,media_type,media_url,timestamp&access_token=${accessToken}`
      );

      const mediaData = await mediaResponse.json();

      // Парсим insights
      const insights = insightsData.data?.reduce((acc: any, item: any) => {
        acc[item.name] = item.values?.[0]?.value || 0;
        return acc;
      }, {});

      const engagement = insights?.engagement || 0;
      const impressions = insights?.impressions || 0;
      const engagementRate = impressions > 0 ? (engagement / impressions) * 100 : 0;

      return {
        likes: mediaData.like_count || 0,
        comments: mediaData.comments_count || 0,
        saves: insights?.saved || 0,
        reach: insights?.reach || 0,
        impressions: impressions,
        views: insights?.video_views || 0,
        engagementRate: parseFloat(engagementRate.toFixed(2)),
        extraMetrics: {
          mediaType: mediaData.media_type,
          timestamp: mediaData.timestamp,
          mediaUrl: mediaData.media_url,
        },
      };
    } catch (error) {
      this.logger.error(
        `Ошибка получения метрик Instagram: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  private extractMediaId(postUrl: string): string {
    // Если это уже ID
    if (/^\d+$/.test(postUrl)) {
      return postUrl;
    }

    // Парсинг из URL: https://www.instagram.com/p/SHORTCODE/
    const match = postUrl.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
    if (match) {
      // Note: В реальности нужно конвертировать shortcode в media_id
      // Это требует дополнительного API вызова или алгоритма декодирования
      throw new Error(
        'Необходимо передать media_id напрямую. Получите его через Instagram Graph API.'
      );
    }

    throw new Error('Некорректный URL или media ID Instagram');
  }
}
