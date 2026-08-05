import { ForbiddenException } from '@nestjs/common';
import { PostAuthorType, Role } from '@prisma/client';
import {
  assertMarketplaceParticipant,
} from '../auth/utils/marketplace-participant.util';

/** Тип постов в ленте; `null` — оба типа (MANAGER). */
export function visiblePostTypeForRole(role: Role): PostAuthorType | null {
  assertMarketplaceParticipant(role);

  if (role === Role.MANAGER) {
    return null;
  }

  if (role === Role.CREATOR) {
    return PostAuthorType.COMPANY;
  }

  return PostAuthorType.CREATOR;
}

export function canViewPost(
  role: Role,
  userId: string,
  post: { ownerId: string; type: PostAuthorType; isPrivate?: boolean }
): boolean {
  if (post.isPrivate) {
    return post.ownerId === userId;
  }

  if (post.ownerId === userId) {
    return true;
  }

  if (role === Role.MANAGER) {
    return true;
  }

  try {
    const visibleType = visiblePostTypeForRole(role);
    return visibleType === null || post.type === visibleType;
  } catch {
    return false;
  }
}

export function assertCanViewPost(
  role: Role,
  userId: string,
  post: { ownerId: string; type: PostAuthorType; isPrivate?: boolean }
): void {
  if (!canViewPost(role, userId, post)) {
    throw new ForbiddenException('Недостаточно прав для просмотра поста');
  }
}
