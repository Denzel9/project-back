import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { AnalyticsService } from './analytics.service';
import {
  CalculateROIDto,
  CollectAnalyticsDto,
  GetAnalyticsHistoryDto,
} from './dto/analytics-query.dto';
import { PublicationAnalyticsResponseDto } from './dto/publication-analytics-response.dto';
import { ROIResponseDto } from './dto/roi-response.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('analytics')
@ApiCookieAuth('access-token')
@Controller('publications/:publicationId/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('collect')
  @ApiOperation({
    summary: 'Собрать аналитику публикации',
    description:
      'Собирает актуальные метрики из соцсети. Для некоторых платформ требуется access token. ' +
      'Доступно участникам задачи (owner/executor).',
  })
  @ApiOkResponse({ type: PublicationAnalyticsResponseDto })
  @ApiNotFoundResponse({ description: 'Публикация не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа к публикации' })
  async collectAnalytics(
    @CurrentUser() user: AuthUser,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @Body() dto: CollectAnalyticsDto,
  ) {
    await this.assertParticipant(publicationId, user.userId);

    const data = await this.analyticsService.collectAnalytics(
      publicationId,
      dto.accessToken,
    );

    return this.toResponse(data);
  }

  @Get('latest')
  @ApiOperation({
    summary: 'Получить последнюю аналитику',
    description: 'Возвращает последние собранные метрики для публикации.',
  })
  @ApiOkResponse({ type: PublicationAnalyticsResponseDto })
  @ApiNotFoundResponse({ description: 'Аналитика не найдена' })
  async getLatestAnalytics(
    @CurrentUser() user: AuthUser,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
  ) {
    await this.assertParticipant(publicationId, user.userId);

    const analytics = await this.analyticsService.getLatestAnalytics(publicationId);

    if (!analytics) {
      return null;
    }

    return {
      ...analytics,
      collectedAt: analytics.collectedAt.toISOString(),
      createdAt: analytics.createdAt.toISOString(),
    };
  }

  @Get('history')
  @ApiOperation({
    summary: 'Получить историю аналитики',
    description: 'Возвращает историю собранных метрик для отображения динамики.',
  })
  @ApiOkResponse({ type: [PublicationAnalyticsResponseDto] })
  async getAnalyticsHistory(
    @CurrentUser() user: AuthUser,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @Query() query: GetAnalyticsHistoryDto,
  ) {
    await this.assertParticipant(publicationId, user.userId);

    const analytics = await this.analyticsService.getAnalyticsHistory(
      publicationId,
      query.limit,
    );

    return analytics.map(item => ({
      ...item,
      collectedAt: item.collectedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    }));
  }

  @Post('roi')
  @ApiOperation({
    summary: 'Рассчитать ROI',
    description:
      'Рассчитывает Return on Investment на основе последних метрик и стоимости кампании. ' +
      'Возвращает ROI%, стоимость за вовлечение и другие показатели эффективности.',
  })
  @ApiOkResponse({ type: ROIResponseDto })
  @ApiNotFoundResponse({ description: 'Аналитика не найдена' })
  async calculateROI(
    @CurrentUser() user: AuthUser,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @Body() dto: CalculateROIDto,
  ) {
    await this.assertParticipant(publicationId, user.userId);

    return this.analyticsService.calculateROI(publicationId, dto.campaignCost);
  }

  private async assertParticipant(publicationId: string, userId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      select: {
        ownerId: true,
        executorId: true,
      },
    });

    if (!publication) {
      throw new Error('Публикация не найдена');
    }

    if (publication.ownerId !== userId && publication.executorId !== userId) {
      throw new Error('Нет доступа к публикации');
    }
  }

  private toResponse(data: any): PublicationAnalyticsResponseDto {
    return {
      id: data.id || 'temp',
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
      extraMetrics: data.extraMetrics,
      collectedAt: data.collectedAt.toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
}
