import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PostAuthorType, Role } from '@prisma/client';

export function visiblePostTypeForRole(role: Role): PostAuthorType {
  if (role === Role.CREATOR) {
    return PostAuthorType.COMPANY;
  }

  if (role === Role.COMPANY) {
    return PostAuthorType.CREATOR;
  }

  throw new BadRequestException('Недопустимая роль');
}

export function canViewPost(
  role: Role,
  userId: string,
  post: { ownerId: string; type: PostAuthorType }
): boolean {
  if (post.ownerId === userId) {
    return true;
  }

  return post.type === visiblePostTypeForRole(role);
}

export function assertCanViewPost(
  role: Role,
  userId: string,
  post: { ownerId: string; type: PostAuthorType }
): void {
  if (!canViewPost(role, userId, post)) {
    throw new ForbiddenException('Недостаточно прав для просмотра поста');
  }
}
