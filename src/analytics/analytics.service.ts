import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsProviderInterface, PublicationAnalyticsData } from './analytics.types';
import { InstagramAnalyticsProvider } from './providers/instagram-analytics.provider';
import { TelegramAnalyticsProvider } from './providers/telegram-analytics.provider';
import { TikTokAnalyticsProvider } from './providers/tiktok-analytics.provider';
import { VKAnalyticsProvider } from './providers/vk-analytics.provider';
import { YouTubeAnalyticsProvider } from './providers/youtube-analytics.provider';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly providers: Map<Platform, AnalyticsProviderInterface>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly instagramProvider: InstagramAnalyticsProvider,
    private readonly telegramProvider: TelegramAnalyticsProvider,
    private readonly tiktokProvider: TikTokAnalyticsProvider,
    private readonly vkProvider: VKAnalyticsProvider,
    private readonly youtubeProvider: YouTubeAnalyticsProvider,
  ) {
    this.providers = new Map([
      [Platform.INSTAGRAM, this.instagramProvider],
      [Platform.TELEGRAM, this.telegramProvider],
      [Platform.TIKTOK, this.tiktokProvider],
      [Platform.VK, this.vkProvider],
      [Platform.YOUTUBE, this.youtubeProvider],
    ]);
  }

  async collectAnalytics(
    publicationId: string,
    accessToken?: string
  ): Promise<PublicationAnalyticsData> {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      select: {
        id: true,
        platform: true,
        externalUrl: true,
        platformLinks: true,
      },
    });

    if (!publication) {
      throw new NotFoundException('Публикация не найдена');
    }

    if (!publication.platform) {
      throw new Error('У публикации не указана платформа');
    }

    const provider = this.providers.get(publication.platform);
    if (!provider) {
      throw new Error(`Провайдер для платформы ${publication.platform} не найден`);
    }

    const postUrl = this.getPostUrl(publication);
    if (!postUrl) {
      throw new Error('URL публикации не найден');
    }

    try {
      const metrics = await provider.fetchMetrics(postUrl, accessToken);

      const analyticsData: PublicationAnalyticsData = {
        publicationId: publication.id,
        platform: publication.platform,
        collectedAt: new Date(),
        ...metrics,
      };

      // Сохраняем в БД
      await this.saveAnalytics(analyticsData);

      return analyticsData;
    } catch (error) {
      this.logger.error(
        `Ошибка сбора аналитики для публикации ${publicationId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async getLatestAnalytics(publicationId: string) {
    const analytics = await this.prisma.publicationAnalytics.findFirst({
      where: { publicationId },
      orderBy: { collectedAt: 'desc' },
    });

    return analytics;
  }

  async getAnalyticsHistory(publicationId: string, limit = 30) {
    const analytics = await this.prisma.publicationAnalytics.findMany({
      where: { publicationId },
      orderBy: { collectedAt: 'desc' },
      take: limit,
    });

    return analytics;
  }

  async getAggregatedAnalytics(publicationIds: string[]) {
    const analytics = await this.prisma.publicationAnalytics.groupBy({
      by: ['publicationId'],
      where: {
        publicationId: { in: publicationIds },
      },
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        reach: true,
        impressions: true,
        followersGain: true,
        linkClicks: true,
      },
      _avg: {
        engagementRate: true,
      },
    });

    return analytics;
  }

  private async saveAnalytics(data: PublicationAnalyticsData) {
    await this.prisma.publicationAnalytics.create({
      data: {
        publicationId: data.publicationId,
        platform: data.platform,
        views: data.views,
        likes: data.likes,
        comments: data.comments,
        shares: data.shares,
        saves: data.saves,
        reach: data.reach,
        impressions: data.impressions,
        followersGain: data.followersGain,
        followersLoss: data.followersLoss,
        engagementRate: data.engagementRate,
        linkClicks: data.linkClicks,
        watchTime: data.watchTime,
        avgWatchTime: data.avgWatchTime,
        extraMetrics: data.extraMetrics || null,
        collectedAt: data.collectedAt,
      },
    });
  }

  private getPostUrl(publication: {
    platform: Platform | null;
    externalUrl: string | null;
    platformLinks: any;
  }): string | null {
    // Сначала проверяем platformLinks
    if (publication.platformLinks && typeof publication.platformLinks === 'object') {
      const links = publication.platformLinks as Record<string, string>;
      if (publication.platform && links[publication.platform]) {
        return links[publication.platform];
      }
    }

    // Fallback на legacy externalUrl
    return publication.externalUrl;
  }

  /**
   * Расчет ROI (Return on Investment)
   * @param publicationId ID публикации
   * @param campaignCost Стоимость кампании
   * @returns ROI данные
   */
  async calculateROI(publicationId: string, campaignCost: number) {
    const analytics = await this.getLatestAnalytics(publicationId);
    
    if (!analytics) {
      throw new NotFoundException('Аналитика для публикации не найдена');
    }

    // Примерная стоимость за действие (можно настраивать)
    const CPV = 0.01; // Cost per view
    const CPL = 0.05; // Cost per like
    const CPC = 0.1;  // Cost per comment
    const CPS = 0.15; // Cost per share

    const estimatedValue = 
      (analytics.views || 0) * CPV +
      (analytics.likes || 0) * CPL +
      (analytics.comments || 0) * CPC +
      (analytics.shares || 0) * CPS;

    const roi = ((estimatedValue - campaignCost) / campaignCost) * 100;
    const cpe = analytics.reach 
      ? campaignCost / analytics.reach 
      : 0; // Cost per engagement

    return {
      campaignCost,
      estimatedValue: parseFloat(estimatedValue.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
      cpe: parseFloat(cpe.toFixed(4)),
      metrics: {
        totalEngagement: 
          (analytics.likes || 0) + 
          (analytics.comments || 0) + 
          (analytics.shares || 0),
        reach: analytics.reach || 0,
        impressions: analytics.impressions || 0,
        engagementRate: analytics.engagementRate || 0,
      },
    };
  }
}
