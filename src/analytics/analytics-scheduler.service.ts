import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsSchedulerService {
  private readonly logger = new Logger(AnalyticsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Обновление аналитики каждые 6 часов
   * Для свежих публикаций (до 7 дней)
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async updateRecentPublications() {
    this.logger.log('Начало обновления аналитики свежих публикаций');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPublications = await this.prisma.publication.findMany({
      where: {
        publishedAt: {
          gte: sevenDaysAgo,
        },
        platform: {
          not: null,
        },
      },
      select: {
        id: true,
        platform: true,
      },
    });

    this.logger.log(`Найдено ${recentPublications.length} свежих публикаций`);

    let successCount = 0;
    let errorCount = 0;

    for (const publication of recentPublications) {
      try {
        await this.analyticsService.collectAnalytics(publication.id);
        successCount++;
      } catch (error) {
        errorCount++;
        this.logger.error(
          `Ошибка обновления аналитики для публикации ${publication.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Небольшая задержка между запросами, чтобы не перегрузить API
      await this.sleep(1000);
    }

    this.logger.log(
      `Обновление завершено. Успешно: ${successCount}, Ошибок: ${errorCount}`
    );
  }

  /**
   * Обновление аналитики раз в день
   * Для старых публикаций (7-30 дней)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async updateOlderPublications() {
    this.logger.log('Начало обновления аналитики старых публикаций');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const olderPublications = await this.prisma.publication.findMany({
      where: {
        publishedAt: {
          gte: thirtyDaysAgo,
          lt: sevenDaysAgo,
        },
        platform: {
          not: null,
        },
      },
      select: {
        id: true,
        platform: true,
      },
    });

    this.logger.log(`Найдено ${olderPublications.length} старых публикаций`);

    let successCount = 0;
    let errorCount = 0;

    for (const publication of olderPublications) {
      try {
        await this.analyticsService.collectAnalytics(publication.id);
        successCount++;
      } catch (error) {
        errorCount++;
        this.logger.error(
          `Ошибка обновления аналитики для публикации ${publication.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      await this.sleep(2000);
    }

    this.logger.log(
      `Обновление завершено. Успешно: ${successCount}, Ошибок: ${errorCount}`
    );
  }

  /**
   * Очистка старой аналитики (старше 90 дней)
   * Оставляем только последнюю запись для истории
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async cleanupOldAnalytics() {
    this.logger.log('Начало очистки старой аналитики');

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Удаляем все записи старше 90 дней, кроме последней для каждой публикации
    const oldAnalytics = await this.prisma.publicationAnalytics.findMany({
      where: {
        collectedAt: {
          lt: ninetyDaysAgo,
        },
      },
      orderBy: {
        collectedAt: 'desc',
      },
      distinct: ['publicationId'],
    });

    const idsToKeep = oldAnalytics.map(a => a.id);

    const deleted = await this.prisma.publicationAnalytics.deleteMany({
      where: {
        collectedAt: {
          lt: ninetyDaysAgo,
        },
        id: {
          notIn: idsToKeep,
        },
      },
    });

    this.logger.log(`Удалено ${deleted.count} старых записей аналитики`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
