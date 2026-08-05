import { DashboardTileType, NotificationType } from '@prisma/client';

/** Все типы, которые сейчас пишутся через NotificationsService.notify */
export const DEFAULT_IN_APP_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.APPLICATION_NEW,
  NotificationType.APPLICATION_STATUS_CHANGED,
  NotificationType.APPLICATION_WITHDRAWN,
  NotificationType.TASK_CREATED,
  NotificationType.TASK_STATUS_CHANGED,
  NotificationType.TASK_EXECUTOR_ASSIGNED,
  NotificationType.TASK_COMMENT_CREATED,
  NotificationType.TASK_MEDIA_ADDED,
  NotificationType.CHAT_MESSAGE,
  NotificationType.TEAM_INVITE,
  NotificationType.MEMBERSHIP_REVOKED,
  NotificationType.PUBLICATION_CREATED,
];

/** Дефолтный whitelist для email (те же типы, что умеет слать notify) */
export const DEFAULT_EMAIL_NOTIFICATION_TYPES: NotificationType[] = [
  ...DEFAULT_IN_APP_NOTIFICATION_TYPES,
];

/** Дефолт для Telegram / MAX — как email */
export const DEFAULT_TELEGRAM_NOTIFICATION_TYPES: NotificationType[] = [
  ...DEFAULT_EMAIL_NOTIFICATION_TYPES,
];

export const DEFAULT_MAX_NOTIFICATION_TYPES: NotificationType[] = [
  ...DEFAULT_EMAIL_NOTIFICATION_TYPES,
];

/** Плитки дашборда по умолчанию: оба role-specific варианта (каталог роли отфильтрует) */
export const DEFAULT_DASHBOARD_TILES: DashboardTileType[] = [
  DashboardTileType.PENDING_ACTION,
  DashboardTileType.PENDING_EXECUTOR_ASSIGN,
  DashboardTileType.NO_EXECUTOR_ASSIGN,
  DashboardTileType.CANCELLED,
  DashboardTileType.OVERDUE,
  DashboardTileType.URGENT,
  DashboardTileType.CHECKING,
];
