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

export async function countUnreadMessages(
  prisma: PrismaService | Prisma.TransactionClient,
  conversationId: string,
  userId: string,
  lastReadAt: Date | null,
  unreadAnchorMessageId?: string | null
): Promise<number> {
  const cursorUnread = await prisma.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      hiddenFor: { none: { userId } },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });

  if (!unreadAnchorMessageId) {
    return cursorUnread;
  }

  const anchor = await prisma.message.findFirst({
    where: {
      id: unreadAnchorMessageId,
      conversationId,
      hiddenFor: { none: { userId } },
    },
    select: { id: true, senderId: true, createdAt: true },
  });

  if (!anchor) {
    return cursorUnread;
  }

  // Anchor already counted among incoming messages after lastReadAt.
  const alreadyCounted =
    anchor.senderId !== userId &&
    (!lastReadAt || anchor.createdAt > lastReadAt);

  if (alreadyCounted) {
    return cursorUnread;
  }

  return cursorUnread + 1;
}
