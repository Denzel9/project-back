import { ApiProperty } from '@nestjs/swagger';
import { DashboardTileType, NotificationType } from '@prisma/client';

export class UserConfigResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({
    enum: NotificationType,
    isArray: true,
    description:
      'Whitelist типов in-app уведомлений (inbox + WebSocket). Пустой массив — все in-app выключены.',
  })
  inAppNotificationTypes: NotificationType[];

  @ApiProperty({
    enum: NotificationType,
    isArray: true,
    description:
      'Whitelist типов email-уведомлений. Пустой массив — все email выключены. ' +
      'Для CHAT_MESSAGE дополнительно: только offline + throttle.',
  })
  emailNotificationTypes: NotificationType[];

  @ApiProperty({
    enum: NotificationType,
    isArray: true,
    description:
      'Whitelist типов Telegram. Пустой массив — все Telegram выключены. ' +
      'Для CHAT_MESSAGE: только offline + throttle.',
  })
  telegramNotificationTypes: NotificationType[];

  @ApiProperty({
    enum: NotificationType,
    isArray: true,
    description:
      'Whitelist типов MAX. Пустой массив — все MAX выключены. ' +
      'Для CHAT_MESSAGE: только offline + throttle.',
  })
  maxNotificationTypes: NotificationType[];

  @ApiProperty({
    enum: DashboardTileType,
    isArray: true,
    description:
      'Активные плитки дашборда CRM в порядке отображения. Пустой массив — все плитки скрыты.',
  })
  dashboardTiles: DashboardTileType[];

  @ApiProperty({ description: 'Показывать блок «Текущие задачи» на дашборде' })
  dashboardShowTasks: boolean;

  @ApiProperty({ description: 'Показывать блок «Активность» на дашборде' })
  dashboardShowActivity: boolean;

  @ApiProperty({ description: 'Показывать блок «Комментарии» на дашборде' })
  dashboardShowComments: boolean;

  @ApiProperty({
    description: 'Настройка календаря на дашборде (persist only)',
  })
  dashboardShowCalendar: boolean;

  @ApiProperty({ description: 'Настройка чатов на дашборде (persist only)' })
  dashboardShowChats: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
