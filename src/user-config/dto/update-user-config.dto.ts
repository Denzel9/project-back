import { ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardTileType, NotificationType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';

function transformNotificationTypes({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  return value;
}

function transformDashboardTiles({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  return value;
}

export class UpdateUserConfigDto {
  @ApiPropertyOptional({
    enum: NotificationType,
    isArray: true,
    description:
      'Полная замена whitelist in-app. Пустой массив — отключить все in-app.',
  })
  @IsOptional()
  @Transform(transformNotificationTypes)
  @IsArray()
  @ArrayUnique()
  @IsEnum(NotificationType, { each: true })
  inAppNotificationTypes?: NotificationType[];

  @ApiPropertyOptional({
    enum: NotificationType,
    isArray: true,
    description:
      'Полная замена whitelist email. Пустой массив — отключить все email.',
  })
  @IsOptional()
  @Transform(transformNotificationTypes)
  @IsArray()
  @ArrayUnique()
  @IsEnum(NotificationType, { each: true })
  emailNotificationTypes?: NotificationType[];

  @ApiPropertyOptional({
    enum: NotificationType,
    isArray: true,
    description:
      'Полная замена whitelist Telegram. Пустой массив — отключить все Telegram.',
  })
  @IsOptional()
  @Transform(transformNotificationTypes)
  @IsArray()
  @ArrayUnique()
  @IsEnum(NotificationType, { each: true })
  telegramNotificationTypes?: NotificationType[];

  @ApiPropertyOptional({
    enum: NotificationType,
    isArray: true,
    description:
      'Полная замена whitelist MAX. Пустой массив — отключить все MAX.',
  })
  @IsOptional()
  @Transform(transformNotificationTypes)
  @IsArray()
  @ArrayUnique()
  @IsEnum(NotificationType, { each: true })
  maxNotificationTypes?: NotificationType[];

  @ApiPropertyOptional({
    enum: DashboardTileType,
    isArray: true,
    description:
      'Активные плитки дашборда CRM в порядке отображения. Пустой массив — скрыть все плитки.',
  })
  @IsOptional()
  @Transform(transformDashboardTiles)
  @IsArray()
  @ArrayUnique()
  @IsEnum(DashboardTileType, { each: true })
  dashboardTiles?: DashboardTileType[];

  @ApiPropertyOptional({
    description: 'Показывать блок «Текущие задачи» на дашборде',
  })
  @IsOptional()
  @IsBoolean()
  dashboardShowTasks?: boolean;

  @ApiPropertyOptional({
    description: 'Показывать блок «Активность» на дашборде',
  })
  @IsOptional()
  @IsBoolean()
  dashboardShowActivity?: boolean;

  @ApiPropertyOptional({
    description: 'Показывать блок «Комментарии» на дашборде',
  })
  @IsOptional()
  @IsBoolean()
  dashboardShowComments?: boolean;

  @ApiPropertyOptional({
    description: 'Настройка календаря на дашборде (persist only)',
  })
  @IsOptional()
  @IsBoolean()
  dashboardShowCalendar?: boolean;

  @ApiPropertyOptional({
    description: 'Настройка чатов на дашборде (persist only)',
  })
  @IsOptional()
  @IsBoolean()
  dashboardShowChats?: boolean;
}
