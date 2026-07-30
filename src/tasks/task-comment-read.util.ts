import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CommentReadInput = {
  authorId: string;
  createdAt: Date;
};

export function isCommentRead(
  comment: CommentReadInput,
  viewerId: string,
  viewerLastReadAt: Date | null,
  peerLastReadAt: Date | null
): boolean {
  const readUpTo =
    comment.authorId === viewerId ? peerLastReadAt : viewerLastReadAt;

  if (!readUpTo) {
    return false;
  }

  return comment.createdAt <= readUpTo;
}

export function countUnreadComments(
  prisma: PrismaService | Prisma.TransactionClient,
  taskId: string,
  userId: string,
  lastReadAt: Date | null
): Promise<number> {
  return prisma.taskComment.count({
    where: {
      taskId,
      authorId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}
