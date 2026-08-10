import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { AnalyticsProviderInterface, SocialMediaMetrics } from '../analytics.types';

@Injectable()
export class YouTubeAnalyticsProvider implements AnalyticsProviderInterface {
  private readonly logger = new Logger(YouTubeAnalyticsProvider.name);
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
  }

  getPlatform(): Platform {
    return Platform.YOUTUBE;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async fetchMetrics(postUrl: string, accessToken?: string): Promise<SocialMediaMetrics> {
    if (!this.isConfigured() && !accessToken) {
      throw new Error('YouTube API Key или access token не настроен');
    }

    try {
      const videoId = this.extractVideoId(postUrl);
      const token = accessToken || this.apiKey;

      // YouTube Data API v3
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?` +
        `part=statistics,contentDetails&id=${videoId}&key=${token}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }

      const data = await response.json();
      const video = data.items?.[0];

      if (!video) {
        return {};
      }

      const stats = video.statistics;
      const duration = this.parseDuration(video.contentDetails?.duration);

      return {
        views: parseInt(stats.viewCount || '0'),
        likes: parseInt(stats.likeCount || '0'),
        comments: parseInt(stats.commentCount || '0'),
        watchTime: duration,
        extraMetrics: {
          favoriteCount: parseInt(stats.favoriteCount || '0'),
          duration: video.contentDetails?.duration,
          definition: video.contentDetails?.definition,
        },
      };
    } catch (error) {
      this.logger.error(
        `Ошибка получения метрик YouTube: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  private extractVideoId(url: string): string {
    // Если это уже ID
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) {
      return url;
    }

    // Парсинг из разных форматов URL
    const patterns = [
      /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
      /youtu\.be\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/v\/([A-Za-z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    throw new Error('Некорректный URL YouTube видео');
  }

  private parseDuration(duration: string): number {
    if (!duration) return 0;

    // Парсинг ISO 8601 duration (PT1H2M10S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }
}
