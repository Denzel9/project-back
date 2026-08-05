import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationType, UserConfig } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserConfigDto } from './dto/update-user-config.dto';
import { UserConfigResponseDto } from './dto/user-config-response.dto';
import {
  DEFAULT_DASHBOARD_TILES,
  DEFAULT_EMAIL_NOTIFICATION_TYPES,
  DEFAULT_IN_APP_NOTIFICATION_TYPES,
  DEFAULT_MAX_NOTIFICATION_TYPES,
  DEFAULT_TELEGRAM_NOTIFICATION_TYPES,
} from './user-config.defaults';

@Injectable()
export class UserConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(user: AuthUser): Promise<UserConfigResponseDto> {
    const config = await this.ensureConfig(user.userId);
    return this.toResponse(config);
  }

  async update(
    user: AuthUser,
    dto: UpdateUserConfigDto
  ): Promise<UserConfigResponseDto> {
    if (
      dto.inAppNotificationTypes === undefined &&
      dto.emailNotificationTypes === undefined &&
      dto.telegramNotificationTypes === undefined &&
      dto.maxNotificationTypes === undefined &&
      dto.dashboardTiles === undefined &&
      dto.dashboardShowTasks === undefined &&
      dto.dashboardShowActivity === undefined &&
      dto.dashboardShowComments === undefined &&
      dto.dashboardShowCalendar === undefined &&
      dto.dashboardShowChats === undefined
    ) {
      throw new BadRequestException(
        'Укажите хотя бы одно поле для обновления конфига'
      );
    }

    await this.ensureConfig(user.userId);

    const updated = await this.prisma.userConfig.update({
      where: { userId: user.userId },
      data: {
        ...(dto.inAppNotificationTypes !== undefined && {
          inAppNotificationTypes: dto.inAppNotificationTypes,
        }),
        ...(dto.emailNotificationTypes !== undefined && {
          emailNotificationTypes: dto.emailNotificationTypes,
        }),
        ...(dto.telegramNotificationTypes !== undefined && {
          telegramNotificationTypes: dto.telegramNotificationTypes,
        }),
        ...(dto.maxNotificationTypes !== undefined && {
          maxNotificationTypes: dto.maxNotificationTypes,
        }),
        ...(dto.dashboardTiles !== undefined && {
          dashboardTiles: dto.dashboardTiles,
        }),
        ...(dto.dashboardShowTasks !== undefined && {
          dashboardShowTasks: dto.dashboardShowTasks,
        }),
        ...(dto.dashboardShowActivity !== undefined && {
          dashboardShowActivity: dto.dashboardShowActivity,
        }),
        ...(dto.dashboardShowComments !== undefined && {
          dashboardShowComments: dto.dashboardShowComments,
        }),
        ...(dto.dashboardShowCalendar !== undefined && {
          dashboardShowCalendar: dto.dashboardShowCalendar,
        }),
        ...(dto.dashboardShowChats !== undefined && {
          dashboardShowChats: dto.dashboardShowChats,
        }),
      },
    });

    return this.toResponse(updated);
  }

  /**
   * Если UserConfig ещё нет — все типы разрешены (дефолт).
   * Если есть — только типы из whitelist.
   */
  async isInAppEnabled(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    const config = await this.prisma.userConfig.findUnique({
      where: { userId },
      select: { inAppNotificationTypes: true },
    });

    if (!config) {
      return true;
    }

    return config.inAppNotificationTypes.includes(type);
  }

  /**
   * Если UserConfig ещё нет — email по дефолтному whitelist.
   * Если есть — только типы из emailNotificationTypes.
   */
  async isEmailEnabled(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    const config = await this.prisma.userConfig.findUnique({
      where: { userId },
      select: { emailNotificationTypes: true },
    });

    if (!config) {
      return DEFAULT_EMAIL_NOTIFICATION_TYPES.includes(type);
    }

    return config.emailNotificationTypes.includes(type);
  }

  async isTelegramEnabled(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    const config = await this.prisma.userConfig.findUnique({
      where: { userId },
      select: { telegramNotificationTypes: true },
    });

    if (!config) {
      return DEFAULT_TELEGRAM_NOTIFICATION_TYPES.includes(type);
    }

    return config.telegramNotificationTypes.includes(type);
  }

  async isMaxEnabled(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    const config = await this.prisma.userConfig.findUnique({
      where: { userId },
      select: { maxNotificationTypes: true },
    });

    if (!config) {
      return DEFAULT_MAX_NOTIFICATION_TYPES.includes(type);
    }

    return config.maxNotificationTypes.includes(type);
  }

  private async ensureConfig(userId: string): Promise<UserConfig> {
    const existing = await this.prisma.userConfig.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.userConfig.create({
      data: {
        userId,
        inAppNotificationTypes: DEFAULT_IN_APP_NOTIFICATION_TYPES,
        emailNotificationTypes: DEFAULT_EMAIL_NOTIFICATION_TYPES,
        telegramNotificationTypes: DEFAULT_TELEGRAM_NOTIFICATION_TYPES,
        maxNotificationTypes: DEFAULT_MAX_NOTIFICATION_TYPES,
        dashboardTiles: DEFAULT_DASHBOARD_TILES,
      },
    });
  }

  private toResponse(config: UserConfig): UserConfigResponseDto {
    return {
      id: config.id,
      userId: config.userId,
      inAppNotificationTypes: config.inAppNotificationTypes,
      emailNotificationTypes: config.emailNotificationTypes,
      telegramNotificationTypes: config.telegramNotificationTypes,
      maxNotificationTypes: config.maxNotificationTypes,
      dashboardTiles: config.dashboardTiles,
      dashboardShowTasks: config.dashboardShowTasks,
      dashboardShowActivity: config.dashboardShowActivity,
      dashboardShowComments: config.dashboardShowComments,
      dashboardShowCalendar: config.dashboardShowCalendar,
      dashboardShowChats: config.dashboardShowChats,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }
}
