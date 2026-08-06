import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Role, Prisma, NotificationType, MessageActorKind } from '@prisma/client';
import {
  ActorAttributionService,
  type ActorSnapshot,
} from '../accounts/actor-attribution.service';
import { StorageService } from '../media/storage.service';
import { ALLOWED_DOCUMENT_MIME_TYPES } from '../media/media.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChatConversationDto,
  ChatAttachmentDto,
  ChatMessageDto,
  ChatMessagePinDto,
  ChatMessageMediaInput,
  ChatPeerDto,
} from './chat.types';
import { SearchMessagesQueryDto } from './dto/search-messages-query.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import {
  AttachmentTypeFilter,
  ListAttachmentsQueryDto,
} from './dto/list-attachments-query.dto';
import { countUnreadMessages, isMessageRead } from './chat-read.util';
import { ChatGateway } from './chat.gateway';

const userWithProfileInclude = {
  creatorProfile: true,
  companyProfile: true,
} as const;

const messageWithMediaInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.MessageInclude;

type UserWithProfile = Awaited<ReturnType<UsersService['findById']>>;

type PrismaTx = Prisma.TransactionClient;

const buildConversationSearchWhere = (
  userId: string,
  q: string
): Prisma.ConversationWhereInput => {
  const tokens = q
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);

  const peerNameMatchers = tokens.map(
    (token): Prisma.ConversationWhereInput => ({
      participants: {
        some: {
          userId: { not: userId },
          user: {
            OR: [
              {
                creatorProfile: {
                  name: { contains: token, mode: 'insensitive' },
                },
              },
              {
                creatorProfile: {
                  lastName: { contains: token, mode: 'insensitive' },
                },
              },
              {
                companyProfile: {
                  companyName: { contains: token, mode: 'insensitive' },
                },
              },
            ],
          },
        },
      },
    })
  );

  return {
    OR: [
      {
        messages: {
          some: {
            content: { contains: q, mode: 'insensitive' },
          },
        },
      },
      ...(peerNameMatchers.length > 0
        ? [{ AND: peerNameMatchers }]
        : []),
    ],
  };
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly actorAttribution: ActorAttributionService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway
  ) {}

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const participations =
      await this.prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true, lastReadAt: true },
      });

    if (participations.length === 0) {
      return { count: 0 };
    }

    const count = await this.prisma.message.count({
      where: {
        OR: participations.map(({ conversationId, lastReadAt }) => ({
          conversationId,
          senderId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        })),
      },
    });

    return { count };
  }

  async listConversations(
    userId: string,
    query: ListConversationsQueryDto = {}
  ): Promise<ChatConversationDto[]> {
    const conversationAnd: Prisma.ConversationWhereInput[] = [];

    if (query.peerId) {
      conversationAnd.push({
        participants: { some: { userId: query.peerId } },
      });
    }

    if (query.q) {
      conversationAnd.push(buildConversationSearchWhere(userId, query.q));
    }

    const where: Prisma.ConversationParticipantWhereInput = {
      userId,
      ...(conversationAnd.length > 0 && {
        conversation: { AND: conversationAnd },
      }),
    };

    const participations = await this.prisma.conversationParticipant.findMany({
      where,
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  include: userWithProfileInclude,
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: messageWithMediaInclude,
            },
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { pinnedAt: 'desc' },
        {
          conversation: {
            updatedAt: 'desc',
          },
        },
      ],
    });

    return Promise.all(
      participations.map(async ({ lastReadAt, isPinned, conversation }) => {
        const peerParticipant = conversation.participants.find(
          participant => participant.userId !== userId
        );

        if (!peerParticipant) {
          throw new NotFoundException('Собеседник не найден');
        }

        const peerLastReadAt = peerParticipant.lastReadAt;
        const lastMessage = conversation.messages[0];
        const unreadCount = await countUnreadMessages(
          this.prisma,
          conversation.id,
          userId,
          lastReadAt
        );

        return {
          id: conversation.id,
          peer: this.mapPeer(peerParticipant.user),
          lastMessage: lastMessage
            ? this.mapMessage(lastMessage, userId, lastReadAt, peerLastReadAt)
            : null,
          unreadCount,
          isPinned,
          updatedAt: conversation.updatedAt,
        };
      })
    );
  }

  async findOrCreateConversation(
    userId: string,
    recipientId: string
  ): Promise<ChatConversationDto> {
    if (userId === recipientId) {
      throw new BadRequestException('Нельзя создать диалог с самим собой');
    }

    const [currentUser, recipient] = await Promise.all([
      this.usersService.findById(userId),
      this.usersService.findById(recipientId),
    ]);

    if (!currentUser || !recipient) {
      throw new NotFoundException('Пользователь не найден');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              include: userWithProfileInclude,
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageWithMediaInclude,
        },
      },
    });

    if (existing) {
      return this.mapConversation(existing, userId);
    }

    const created = await this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: recipientId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: userWithProfileInclude,
            },
          },
        },
        messages: {
          include: messageWithMediaInclude,
        },
      },
    });

    return this.mapConversation(created, userId);
  }

  async updateConversationPin(
    conversationId: string,
    userId: string,
    isPinned: boolean
  ): Promise<ChatConversationDto> {
    await this.assertParticipant(conversationId, userId);

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        isPinned,
        pinnedAt: isPinned ? new Date() : null,
      },
    });

    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              include: userWithProfileInclude,
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageWithMediaInclude,
        },
      },
    });

    return this.mapConversation(conversation, userId);
  }

  async pinMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    isPinned: boolean
  ): Promise<void> {
    await this.assertParticipant(conversationId, userId);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true },
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    if (isPinned) {
      await this.prisma.messagePin.upsert({
        where: { messageId },
        create: {
          conversationId,
          messageId,
          pinnedById: userId,
        },
        update: {
          conversationId,
          pinnedAt: new Date(),
          pinnedById: userId,
        },
      });
      return;
    }

    // messageId уникален, но deleteMany более безопасен (не падает, если записи ещё нет)
    await this.prisma.messagePin.deleteMany({ where: { messageId } });
  }

  async listMessagePins(
    conversationId: string,
    userId: string,
    limit = 50
  ): Promise<ChatMessagePinDto[]> {
    await this.assertParticipant(conversationId, userId);

    const pins = await this.prisma.messagePin.findMany({
      where: { conversationId },
      orderBy: { pinnedAt: 'desc' },
      take: limit,
      select: {
        messageId: true,
        pinnedAt: true,
        pinnedById: true,
        message: {
          select: {
            content: true,
            createdAt: true,
            senderId: true,
            actorDisplayName: true,
            actorKind: true,
            sender: {
              include: userWithProfileInclude,
            },
            _count: { select: { media: true } },
          },
        },
      },
    });

    return pins.map(pin => ({
      messageId: pin.messageId,
      content: pin.message.content,
      mediaCount: pin.message._count.media,
      pinnedAt: pin.pinnedAt,
      pinnedById: pin.pinnedById ?? undefined,
      createdAt: pin.message.createdAt,
      senderId: pin.message.senderId,
      senderDisplayName: this.mapPeer(pin.message.sender).displayName,
      actorDisplayName: pin.message.actorDisplayName ?? null,
      actorKind: pin.message.actorKind ?? null,
    }));
  }

  async listMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50,
    markRead?: boolean
  ): Promise<ChatMessageDto[]> {
    await this.assertParticipant(conversationId, userId);

    const shouldMarkRead = markRead ?? !cursor;
    let readState = await this.getConversationReadState(conversationId, userId);

    if (shouldMarkRead) {
      const readAt = await this.markConversationAsRead(conversationId, userId);
      readState = { ...readState, viewerLastReadAt: readAt };
    }

    const cursorMessage = cursor
      ? await this.prisma.message.findUnique({
        where: { id: cursor },
      })
      : null;

    if (
      cursor &&
      (!cursorMessage || cursorMessage.conversationId !== conversationId)
    ) {
      throw new BadRequestException('Недействительный курсор пагинации');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursorMessage
          ? {
            OR: [
              { createdAt: { lt: cursorMessage.createdAt } },
              {
                createdAt: cursorMessage.createdAt,
                id: { lt: cursorMessage.id },
              },
            ],
          }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: messageWithMediaInclude,
    });

    return messages
      .reverse()
      .map(message =>
        this.mapMessage(
          message,
          userId,
          readState.viewerLastReadAt,
          readState.peerLastReadAt
        )
      );
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<Date> {
    await this.assertParticipant(conversationId, userId);

    const latestMessage = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true },
    });

    const readAt = latestMessage?.createdAt ?? new Date();

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: { lastReadAt: readAt },
    });

    this.chatGateway.broadcastMessagesRead(conversationId, {
      conversationId,
      userId,
      readAt: readAt.toISOString(),
    });

    return readAt;
  }

  async searchMessages(
    conversationId: string,
    userId: string,
    query: SearchMessagesQueryDto
  ): Promise<{
    items: ChatMessageDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.assertParticipant(conversationId, userId);

    const readState = await this.getConversationReadState(
      conversationId,
      userId
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MessageWhereInput = {
      conversationId,
      content: { contains: query.q, mode: 'insensitive' },
    };

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: messageWithMediaInclude,
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      items: messages.map(message =>
        this.mapMessage(
          message,
          userId,
          readState.viewerLastReadAt,
          readState.peerLastReadAt
        )
      ),
      total,
      page,
      limit,
    };
  }

  async listAttachments(
    conversationId: string,
    userId: string,
    query: ListAttachmentsQueryDto
  ): Promise<{
    items: ChatAttachmentDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.assertParticipant(conversationId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MessageMediaWhereInput = {
      message: { conversationId },
      ...(query.type === AttachmentTypeFilter.IMAGE && {
        mimeType: { startsWith: 'image/' },
      }),
      ...(query.type === AttachmentTypeFilter.VIDEO && {
        mimeType: { startsWith: 'video/' },
      }),
      ...(query.type === AttachmentTypeFilter.DOCUMENT && {
        mimeType: { in: [...ALLOWED_DOCUMENT_MIME_TYPES] },
      }),
    };

    const [attachments, total] = await Promise.all([
      this.prisma.messageMedia.findMany({
        where,
        orderBy: [{ message: { createdAt: 'desc' } }, { sortOrder: 'asc' }],
        skip,
        take: limit,
        include: {
          message: {
            select: {
              id: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.messageMedia.count({ where }),
    ]);

    return {
      items: attachments.map(attachment => this.mapAttachment(attachment)),
      total,
      page,
      limit,
    };
  }

  async removeAttachment(
    userId: string,
    conversationId: string,
    mediaId: string
  ): Promise<void> {
    await this.assertParticipant(conversationId, userId);

    const media = await this.prisma.messageMedia.findFirst({
      where: {
        id: mediaId,
        message: { conversationId },
      },
      include: {
        message: {
          select: {
            id: true,
            senderId: true,
            content: true,
            media: { select: { id: true } },
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Медиа не найдено');
    }

    if (media.message.senderId !== userId) {
      throw new ForbiddenException('Недостаточно прав для удаления вложения');
    }

    try {
      await this.storageService.deleteObject(media.key);
    } catch {
      throw new InternalServerErrorException('Не удалось удалить файл');
    }

    const remainingMediaCount = media.message.media.filter(
      item => item.id !== mediaId
    ).length;
    const hasContent = media.message.content.trim().length > 0;

    await this.prisma.$transaction(async tx => {
      await tx.messageMedia.delete({
        where: { id: mediaId },
      });

      if (!hasContent && remainingMediaCount === 0) {
        await tx.message.delete({
          where: { id: media.message.id },
        });
      }
    });
  }

  async removeMessage(
    conversationId: string,
    userId: string,
    messageId: string
  ): Promise<{ conversationId: string; messageId: string }> {
    await this.assertParticipant(conversationId, userId);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      include: { media: true },
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Недостаточно прав для удаления сообщения');
    }

    for (const item of message.media) {
      try {
        await this.storageService.deleteObject(item.key);
      } catch {
        throw new InternalServerErrorException('Не удалось удалить файл');
      }
    }

    await this.prisma.$transaction(async tx => {
      await tx.message.delete({
        where: { id: messageId },
      });

      const latestMessage = await tx.message.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: latestMessage?.createdAt ?? new Date(),
        },
      });
    });

    const payload = { conversationId, messageId };

    this.chatGateway.broadcastMessageDeleted(conversationId, payload);

    return payload;
  }

  async updateMessage(
    conversationId: string,
    userId: string,
    messageId: string,
    content: string
  ): Promise<ChatMessageDto> {
    await this.assertParticipant(conversationId, userId);

    const existing = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      include: messageWithMediaInclude,
    });

    if (!existing) {
      throw new NotFoundException('Сообщение не найдено');
    }

    if (existing.senderId !== userId) {
      throw new ForbiddenException('Недостаточно прав для редактирования сообщения');
    }

    const trimmedContent = content.trim();

    if (!trimmedContent && existing.media.length === 0) {
      throw new BadRequestException('Сообщение не может быть пустым');
    }

    if (trimmedContent === existing.content.trim()) {
      const readState = await this.getConversationReadState(
        conversationId,
        userId
      );

      return this.mapMessage(
        existing,
        userId,
        readState.viewerLastReadAt,
        readState.peerLastReadAt
      );
    }

    const editedAt = new Date();

    const updated = await this.prisma.$transaction(async tx => {
      const message = await tx.message.update({
        where: { id: messageId },
        data: {
          content: trimmedContent,
          editedAt,
        },
        include: messageWithMediaInclude,
      });

      const latestMessage = await tx.message.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });

      if (latestMessage?.id === messageId) {
        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: editedAt },
        });
      }

      return message;
    });

    const readState = await this.getConversationReadState(
      conversationId,
      userId
    );

    const response = this.mapMessage(
      updated,
      userId,
      readState.viewerLastReadAt,
      readState.peerLastReadAt
    );

    this.chatGateway.broadcastMessageEdited(conversationId, response);

    return response;
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    content = '',
    media: ChatMessageMediaInput[] = [],
    isRedirected = false,
    actorAccountId?: string
  ): Promise<ChatMessageDto> {
    const trimmedContent = content.trim();
    const normalizedMedia = media ?? [];

    if (!trimmedContent && normalizedMedia.length === 0) {
      throw new BadRequestException('Сообщение не может быть пустым');
    }

    await this.assertParticipant(conversationId, senderId);

    const expectedKeyPrefix = `chats/${conversationId}/`;
    for (const item of normalizedMedia) {
      if (!item.key.startsWith(expectedKeyPrefix)) {
        throw new BadRequestException(
          'Недопустимый ключ медиа для этого диалога'
        );
      }
    }

    const actor = actorAccountId
      ? await this.actorAttribution.resolve(actorAccountId, senderId)
      : null;

    const message = await this.prisma.$transaction(tx =>
      this.createMessageInTransaction(
        tx,
        conversationId,
        senderId,
        trimmedContent,
        normalizedMedia,
        isRedirected,
        actor
      )
    );

    await this.notifyRecipientAboutMessage(
      conversationId,
      senderId,
      message,
      actor
    );

    const readState = await this.getConversationReadState(
      conversationId,
      senderId
    );

    return this.mapMessage(
      message,
      senderId,
      readState.viewerLastReadAt,
      readState.peerLastReadAt
    );
  }

  private async notifyRecipientAboutMessage(
    conversationId: string,
    senderId: string,
    message: {
      id: string;
      content: string;
      media?: Array<{ id: string }>;
    },
    actor: ActorSnapshot | null = null
  ): Promise<void> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    const recipientId = participants
      .map(participant => participant.userId)
      .find(userId => userId !== senderId);

    if (!recipientId) {
      return;
    }

    const preview =
      message.content.trim().length > 0
        ? message.content.trim().slice(0, 200)
        : message.media && message.media.length > 0
          ? '[медиа]'
          : 'Новое сообщение';

    await this.notificationsService.notify({
      recipientId,
      actorId: senderId,
      actor,
      type: NotificationType.CHAT_MESSAGE,
      title: 'Новое сообщение в чате',
      body: preview,
      payload: {
        entityType: 'conversation',
        entityId: conversationId,
        conversationId,
        meta: {
          messageId: message.id,
          preview,
        },
      },
    });
  }

  private async createMessageInTransaction(
    tx: PrismaTx,
    conversationId: string,
    senderId: string,
    content: string,
    media: ChatMessageMediaInput[] = [],
    isRedirected = false,
    actor: ActorSnapshot | null = null
  ) {
    const trimmedContent = content.trim();
    const normalizedMedia = media ?? [];

    if (!trimmedContent && normalizedMedia.length === 0) {
      throw new BadRequestException('Сообщение не может быть пустым');
    }

    const expectedKeyPrefix = `chats/${conversationId}/`;
    for (const item of normalizedMedia) {
      if (!item.key.startsWith(expectedKeyPrefix)) {
        throw new BadRequestException(
          'Недопустимый ключ медиа для этого диалога'
        );
      }
    }

    const created = await tx.message.create({
      data: {
        conversationId,
        senderId,
        content: trimmedContent,
        isRedirected,
        ...this.actorAttribution.toPrismaFields(actor),
        ...(normalizedMedia.length > 0 && {
          media: {
            create: normalizedMedia.map((item, index) => ({
              url: item.url,
              key: item.key,
              size: String(item.size),
              mimeType: item.mimeType,
              sortOrder: index,
            })),
          },
        }),
      },
      include: messageWithMediaInclude,
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: created.createdAt },
    });

    return created;
  }

  async assertParticipant(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Нет доступа к этому диалогу');
    }
  }

  private async mapConversation(
    conversation: {
      id: string;
      updatedAt: Date;
      participants: Array<{
        userId: string;
        lastReadAt: Date | null;
        isPinned?: boolean;
        user: NonNullable<UserWithProfile>;
      }>;
      messages: Array<{
        id: string;
        conversationId: string;
        senderId: string;
        content: string;
        createdAt: Date;
        media?: Array<{
          url: string;
          key: string;
          size: string;
          mimeType: string;
        }>;
      }>;
    },
    userId: string
  ): Promise<ChatConversationDto> {
    const viewerParticipant = conversation.participants.find(
      participant => participant.userId === userId
    );
    const peerParticipant = conversation.participants.find(
      participant => participant.userId !== userId
    );

    if (!peerParticipant || !viewerParticipant) {
      throw new NotFoundException('Собеседник не найден');
    }

    const lastMessage = conversation.messages[0];
    const viewerLastReadAt = viewerParticipant.lastReadAt;
    const peerLastReadAt = peerParticipant.lastReadAt;
    const unreadCount = await countUnreadMessages(
      this.prisma,
      conversation.id,
      userId,
      viewerLastReadAt
    );

    return {
      id: conversation.id,
      peer: this.mapPeer(peerParticipant.user),
      lastMessage: lastMessage
        ? this.mapMessage(lastMessage, userId, viewerLastReadAt, peerLastReadAt)
        : null,
      unreadCount,
      isPinned: viewerParticipant.isPinned ?? false,
      updatedAt: conversation.updatedAt,
    };
  }

  private mapPeer(user: NonNullable<UserWithProfile>): ChatPeerDto {
    if (user.role === Role.CREATOR && user.creatorProfile) {
      return {
        id: user.id,
        role: user.role,
        avatar: user.avatar,
        displayName: `${user.creatorProfile.name} ${user.creatorProfile.lastName}`,
      };
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return {
        id: user.id,
        role: user.role,
        avatar: user.avatar,
        displayName: user.companyProfile.companyName,
      };
    }

    return {
      id: user.id,
      role: user.role,
      avatar: user.avatar,
      displayName: user.role,
    };
  }

  private mapMessage(
    message: {
      id: string;
      conversationId: string;
      senderId: string;
      actorAccountId?: string | null;
      actorDisplayName?: string | null;
      actorKind?: MessageActorKind | null;
      content: string;
      createdAt: Date;
      editedAt?: Date | null;
      isRedirected?: boolean;
      media?: Array<{
        url: string;
        key: string;
        size: string;
        mimeType: string;
      }>;
    },
    viewerId: string,
    viewerLastReadAt: Date | null,
    peerLastReadAt: Date | null
  ): ChatMessageDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      actorAccountId: message.actorAccountId ?? null,
      actorDisplayName: message.actorDisplayName ?? null,
      actorKind: message.actorKind ?? null,
      content: message.content,
      media: (message.media ?? []).map(item => ({
        url: item.url,
        key: item.key,
        size: item.size,
        mimeType: item.mimeType,
      })),
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      isRedirected: message.isRedirected ?? false,
      isRead: isMessageRead(
        message,
        viewerId,
        viewerLastReadAt,
        peerLastReadAt
      ),
    };
  }

  private async getConversationReadState(
    conversationId: string,
    userId: string
  ): Promise<{
    viewerLastReadAt: Date | null;
    peerLastReadAt: Date | null;
  }> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true, lastReadAt: true },
    });

    const viewer = participants.find(
      participant => participant.userId === userId
    );
    const peer = participants.find(
      participant => participant.userId !== userId
    );

    if (!viewer) {
      throw new ForbiddenException('Нет доступа к этому диалогу');
    }

    return {
      viewerLastReadAt: viewer.lastReadAt,
      peerLastReadAt: peer?.lastReadAt ?? null,
    };
  }

  private mapAttachment(attachment: {
    id: string;
    url: string;
    key: string;
    size: string;
    mimeType: string;
    message: {
      id: string;
      senderId: string;
      createdAt: Date;
    };
  }): ChatAttachmentDto {
    return {
      id: attachment.id,
      messageId: attachment.message.id,
      senderId: attachment.message.senderId,
      url: attachment.url,
      key: attachment.key,
      size: attachment.size,
      mimeType: attachment.mimeType,
      createdAt: attachment.message.createdAt,
    };
  }
}
