import { Platform } from '@prisma/client';

export interface SocialMediaMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  impressions?: number;
  followersGain?: number;
  followersLoss?: number;
  engagementRate?: number;
  linkClicks?: number;
  watchTime?: number;
  avgWatchTime?: number;
  extraMetrics?: Record<string, any>;
}

export interface AnalyticsProviderInterface {
  getPlatform(): Platform;
  fetchMetrics(postUrl: string, accessToken?: string): Promise<SocialMediaMetrics>;
  isConfigured(): boolean;
}

export interface PublicationAnalyticsData extends SocialMediaMetrics {
  publicationId: string;
  platform: Platform;
  collectedAt: Date;
}
