import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { AnalyticsProviderInterface, SocialMediaMetrics } from '../analytics.types';

@Injectable()
export class TikTokAnalyticsProvider implements AnalyticsProviderInterface {
  private readonly logger = new Logger(TikTokAnalyticsProvider.name);

  getPlatform(): Platform {
    return Platform.TIKTOK;
  }

  isConfigured(): boolean {
    return true;
  }

  async fetchMetrics(postUrl: string, accessToken?: string): Promise<SocialMediaMetrics> {
    if (!accessToken) {
      throw new Error('TikTok требует access token для получения метрик');
    }

    try {
      const videoId = this.extractVideoId(postUrl);

      // TikTok for Developers API
      // https://developers.tiktok.com/doc/research-api-specs-query-videos
      const response = await fetch(
        'https://open.tiktokapis.com/v2/research/video/query/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filters: {
              video_id: videoId,
            },
            max_count: 1,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`TikTok API error: ${response.statusText}`);
      }

      const data = await response.json();
      const video = data.data?.videos?.[0];

      if (!video) {
        return {};
      }

      const totalEngagement = 
        (video.like_count || 0) + 
        (video.comment_count || 0) + 
        (video.share_count || 0);
      
      const engagementRate = video.view_count > 0
        ? (totalEngagement / video.view_count) * 100
        : 0;

      return {
        views: video.view_count || 0,
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        saves: video.favorite_count || 0,
        engagementRate: parseFloat(engagementRate.toFixed(2)),
        extraMetrics: {
          duration: video.video_duration,
          hashtags: video.hashtag_names,
          musicTitle: video.music_title,
          effectIds: video.effect_ids,
        },
      };
    } catch (error) {
      this.logger.error(
        `Ошибка получения метрик TikTok: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  private extractVideoId(url: string): string {
    // Если это уже ID
    if (/^\d+$/.test(url)) {
      return url;
    }

    // Парсинг из URL: https://www.tiktok.com/@username/video/1234567890
    const match = url.match(/tiktok\.com\/@[^\/]+\/video\/(\d+)/);
    if (match) {
      return match[1];
    }

    // Короткий URL: https://vm.tiktok.com/XXXXX/
    // Требует редиректа для получения полного URL
    throw new Error('Некорректный URL TikTok видео или требуется полный URL');
  }
}
