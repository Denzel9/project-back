import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

export const MANAGER_SHELL_FORBIDDEN_MESSAGE =
  'Профиль менеджера неактивен. Дождитесь приглашения к управлению компанией или профилем.';

export const MANAGER_TRADE_FORBIDDEN_MESSAGE =
  'Менеджер не может публиковать посты и откликаться. Переключитесь на профиль компании или креатора.';

/** Просмотр ленты, избранное, чат — CREATOR / COMPANY / MANAGER */
export function isMarketplaceParticipant(role: Role): boolean {
  return (
    role === Role.CREATOR || role === Role.COMPANY || role === Role.MANAGER
  );
}

/** Публикация постов и отклики — только CREATOR / COMPANY */
export function isMarketplaceTrader(role: Role): boolean {
  return role === Role.CREATOR || role === Role.COMPANY;
}

export function assertMarketplaceParticipant(role: Role): void {
  if (!isMarketplaceParticipant(role)) {
    throw new ForbiddenException(MANAGER_SHELL_FORBIDDEN_MESSAGE);
  }
}

export function assertMarketplaceTrader(role: Role): void {
  if (!isMarketplaceTrader(role)) {
    throw new ForbiddenException(MANAGER_TRADE_FORBIDDEN_MESSAGE);
  }
}
