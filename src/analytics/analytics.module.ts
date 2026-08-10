import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';
import { InstagramAnalyticsProvider } from './providers/instagram-analytics.provider';
import { TelegramAnalyticsProvider } from './providers/telegram-analytics.provider';
import { TikTokAnalyticsProvider } from './providers/tiktok-analytics.provider';
import { VKAnalyticsProvider } from './providers/vk-analytics.provider';
import { YouTubeAnalyticsProvider } from './providers/youtube-analytics.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsSchedulerService,
    InstagramAnalyticsProvider,
    TelegramAnalyticsProvider,
    TikTokAnalyticsProvider,
    VKAnalyticsProvider,
    YouTubeAnalyticsProvider,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
