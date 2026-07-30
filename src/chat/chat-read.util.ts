import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type MessageReadInput = {
  senderId: string;
  createdAt: Date;
};

export function isMessageRead(
  message: MessageReadInput,
  viewerId: string,
  viewerLastReadAt: Date | null,
  peerLastReadAt: Date | null
): boolean {
  const readUpTo =
    message.senderId === viewerId ? peerLastReadAt : viewerLastReadAt;

  if (!readUpTo) {
    return false;
  }

  return message.createdAt <= readUpTo;
}

export function countUnreadMessages(
  prisma: PrismaService | Prisma.TransactionClient,
  conversationId: string,
  userId: string,
  lastReadAt: Date | null
): Promise<number> {
  return prisma.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}
