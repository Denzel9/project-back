import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  Role,
  Prisma,
  NotificationType,
  MessageActorKind,
  MessagePinScope,
} from '@prisma/client';
import {
  ActorAttributionService,
  type ActorSnapshot,
} from '../accounts/actor-attribution.service';
import { StorageService } from '../media/storage.service';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MIME_TO_EXTENSION,
  sanitizeUploadFileName,
} from '../media/media.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChatConversationDto,
  ChatAttachmentDto,
  ChatMessageDto,
  ChatMessagesPageDto,
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
import { randomUUID } from 'crypto';

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
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly actorAttribution: ActorAttributionService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway
  ) {}

  private notHiddenFilter(userId: string): Prisma.MessageWhereInput {
    return { hiddenFor: { none: { userId } } };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const participations =
      await this.prisma.conversationParticipant.findMany({
        where: { userId, hiddenAt: null },
        select: {
          conversationId: true,
          lastReadAt: true,
          unreadAnchorMessageId: true,
          isMarkedUnread: true,
        },
      });

    if (participations.length === 0) {
      return { count: 0 };
    }

    const counts = await Promise.all(
      participations.map(
        async ({
          conversationId,
          lastReadAt,
          unreadAnchorMessageId,
          isMarkedUnread,
        }) => {
          const messageUnread = await countUnreadMessages(
            this.prisma,
            conversationId,
            userId,
            lastReadAt,
            unreadAnchorMessageId
          );

          return Math.max(messageUnread, isMarkedUnread ? 1 : 0);
        }
      )
    );

    return { count: counts.reduce((sum, value) => sum + value, 0) };
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
      hiddenAt: null,
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
              where: this.notHiddenFilter(userId),
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
      participations.map(({ conversation }) =>
        this.mapConversation(conversation, userId)
      )
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
        isNotes: false,
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
          where: this.notHiddenFilter(userId),
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageWithMediaInclude,
        },
      },
    });

    if (existing) {
      await this.unhideConversationForUser(existing.id, userId);
      return this.mapConversation(existing, userId);
    }

    if (currentUser.role === Role.MANAGER) {
      throw new ForbiddenException(
        'Менеджер не может начинать новые диалоги. Можно отвечать во входящих и писать в «Заметки».'
      );
    }

    const created = await this.prisma.conversation.create({
      data: {
        isNotes: false,
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

  async findOrCreateNotesConversation(
    userId: string
  ): Promise<ChatConversationDto> {
    const currentUser = await this.usersService.findById(userId);

    if (!currentUser) {
      throw new NotFoundException('Пользователь не найден');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        isNotes: true,
        participants: { some: { userId } },
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
          where: this.notHiddenFilter(userId),
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageWithMediaInclude,
        },
      },
    });

    if (existing) {
      await this.unhideConversationForUser(existing.id, userId);
      return this.mapConversation(existing, userId);
    }

    const created = await this.prisma.conversation.create({
      data: {
        isNotes: true,
        participants: {
          create: [{ userId }],
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
          where: this.notHiddenFilter(userId),
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageWithMediaInclude,
        },
      },
    });

    return this.mapConversation(conversation, userId);
  }

  async hideConversation(
    conversationId: string,
    userId: string
  ): Promise<void> {
    await this.assertParticipant(conversationId, userId);

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: { hiddenAt: new Date() },
    });
  }

  private async unhideConversationForUser(
    conversationId: string,
    userId: string
  ): Promise<void> {
    await this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId,
        hiddenAt: { not: null },
      },
      data: { hiddenAt: null },
    });
  }

  async pinMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    isPinned: boolean,
    scope?: MessagePinScope
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
      if (!scope) {
        throw new BadRequestException(
          'Укажите scope: PERSONAL или SHARED'
        );
      }

      const existingPins = await this.prisma.messagePin.findMany({
        where: { messageId },
        select: { id: true, scope: true, pinnedById: true },
      });

      const otherPins = existingPins.filter(pin => pin.pinnedById !== userId);

      if (scope === MessagePinScope.PERSONAL) {
        const foreignShared = otherPins.find(
          pin => pin.scope === MessagePinScope.SHARED
        );

        if (foreignShared) {
          throw new ForbiddenException(
            'Сообщение уже закреплено для всех'
          );
        }
      }

      if (scope === MessagePinScope.SHARED && otherPins.length > 0) {
        throw new ForbiddenException(
          'Сообщение уже закреплено другим участником'
        );
      }

      await this.prisma.messagePin.upsert({
        where: {
          messageId_pinnedById: { messageId, pinnedById: userId },
        },
        create: {
          conversationId,
          messageId,
          pinnedById: userId,
          scope,
        },
        update: {
          conversationId,
          pinnedAt: new Date(),
          scope,
        },
      });
      return;
    }

    const ownPin = await this.prisma.messagePin.findUnique({
      where: {
        messageId_pinnedById: { messageId, pinnedById: userId },
      },
      select: { id: true },
    });

    if (ownPin) {
      await this.prisma.messagePin.delete({ where: { id: ownPin.id } });
      return;
    }

    const sharedPin = await this.prisma.messagePin.findFirst({
      where: { messageId, scope: MessagePinScope.SHARED },
      select: { id: true, pinnedById: true },
    });

    if (sharedPin) {
      throw new ForbiddenException(
        'Открепить общее закрепление может только тот, кто закрепил'
      );
    }
  }

  async listMessagePins(
    conversationId: string,
    userId: string,
    limit = 50
  ): Promise<ChatMessagePinDto[]> {
    await this.assertParticipant(conversationId, userId);

    const pins = await this.prisma.messagePin.findMany({
      where: {
        conversationId,
        OR: [
          { scope: MessagePinScope.SHARED },
          { scope: MessagePinScope.PERSONAL, pinnedById: userId },
        ],
      },
      orderBy: { pinnedAt: 'desc' },
      take: limit,
      select: {
        messageId: true,
        scope: true,
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
      scope: pin.scope,
      pinnedAt: pin.pinnedAt,
      pinnedById: pin.pinnedById ?? undefined,
      createdAt: pin.message.createdAt,
      senderId: pin.message.senderId,
      senderDisplayName: this.mapPeer(pin.message.sender).displayName,
      actorDisplayName: pin.message.actorDisplayName ?? null,
      actorKind: pin.message.actorKind ?? null,
    }));
  }

  private olderThan(message: {
    createdAt: Date;
    id: string;
  }): Prisma.MessageWhereInput {
    return {
      OR: [
        { createdAt: { lt: message.createdAt } },
        { createdAt: message.createdAt, id: { lt: message.id } },
      ],
    };
  }

  private newerThan(message: {
    createdAt: Date;
    id: string;
  }): Prisma.MessageWhereInput {
    return {
      OR: [
        { createdAt: { gt: message.createdAt } },
        { createdAt: message.createdAt, id: { gt: message.id } },
      ],
    };
  }

  private mapMessagePage(
    messages: Parameters<ChatService['mapMessage']>[0][],
    userId: string,
    viewerLastReadAt: Date | null,
    peerLastReadAt: Date | null,
    hasOlder: boolean,
    hasNewer: boolean,
  ): ChatMessagesPageDto {
    return {
      items: messages.map(message =>
        this.mapMessage(message, userId, viewerLastReadAt, peerLastReadAt),
      ),
      hasOlder,
      hasNewer,
    };
  }

  async listMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    around?: string,
    after?: string,
    limit = 50,
    markRead?: boolean
  ): Promise<ChatMessagesPageDto> {
    await this.assertParticipant(conversationId, userId);

    const exclusiveCount = [cursor, around, after].filter(Boolean).length;

    if (exclusiveCount > 1) {
      throw new BadRequestException(
        'Параметры cursor, around и after нельзя сочетать',
      );
    }

    const shouldMarkRead = markRead ?? exclusiveCount === 0;
    let readState = await this.getConversationReadState(conversationId, userId);

    if (shouldMarkRead) {
      const readAt = await this.markConversationAsRead(conversationId, userId);
      readState = { ...readState, viewerLastReadAt: readAt };
    }

    const mapPage = (
      messages: Parameters<ChatService['mapMessage']>[0][],
      hasOlder: boolean,
      hasNewer: boolean,
    ) =>
      this.mapMessagePage(
        messages,
        userId,
        readState.viewerLastReadAt,
        readState.peerLastReadAt,
        hasOlder,
        hasNewer,
      );

    const baseWhere: Prisma.MessageWhereInput = {
      conversationId,
      ...this.notHiddenFilter(userId),
    };

    if (around) {
      const target = await this.prisma.message.findFirst({
        where: { ...baseWhere, id: around },
        include: messageWithMediaInclude,
      });

      if (!target) {
        throw new NotFoundException('Сообщение не найдено');
      }

      const side = Math.max(1, Math.floor(limit / 2));

      const [older, newer] = await Promise.all([
        this.prisma.message.findMany({
          where: { ...baseWhere, ...this.olderThan(target) },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: side + 1,
          include: messageWithMediaInclude,
        }),
        this.prisma.message.findMany({
          where: { ...baseWhere, ...this.newerThan(target) },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: side + 1,
          include: messageWithMediaInclude,
        }),
      ]);

      const hasOlder = older.length > side;
      const hasNewer = newer.length > side;

      return mapPage(
        [...older.slice(0, side).reverse(), target, ...newer.slice(0, side)],
        hasOlder,
        hasNewer,
      );
    }

    if (after) {
      const afterMessage = await this.prisma.message.findUnique({
        where: { id: after },
      });

      if (
        !afterMessage ||
        afterMessage.conversationId !== conversationId
      ) {
        throw new BadRequestException('Недействительный курсор пагинации');
      }

      const newer = await this.prisma.message.findMany({
        where: { ...baseWhere, ...this.newerThan(afterMessage) },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit + 1,
        include: messageWithMediaInclude,
      });

      const hasNewer = newer.length > limit;

      return mapPage(newer.slice(0, limit), true, hasNewer);
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
        ...baseWhere,
        ...(cursorMessage ? this.olderThan(cursorMessage) : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: messageWithMediaInclude,
    });

    const hasOlder = messages.length > limit;

    return mapPage(
      messages.slice(0, limit).reverse(),
      hasOlder,
      Boolean(cursor),
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
      data: {
        lastReadAt: readAt,
        unreadAnchorMessageId: null,
        isMarkedUnread: false,
      },
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
      ...this.notHiddenFilter(userId),
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
      message: {
        conversationId,
        ...this.notHiddenFilter(userId),
      },
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
  ): Promise<{ conversationId: string; messageIds: string[] }> {
    await this.assertParticipant(conversationId, userId);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true },
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    await this.prisma.messageHidden.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      create: {
        messageId,
        userId,
      },
      update: {},
    });

    const payload = { conversationId, messageIds: [messageId] };

    this.chatGateway.broadcastMessageHiddenForUser(userId, payload);

    return payload;
  }

  async hideMessages(
    conversationId: string,
    userId: string,
    messageIds: string[]
  ): Promise<{ conversationId: string; messageIds: string[] }> {
    await this.assertParticipant(conversationId, userId);

    if (messageIds.length === 0) {
      return { conversationId, messageIds: [] };
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        id: { in: messageIds },
      },
      select: { id: true },
    });

    const foundIds = messages.map(message => message.id);

    if (foundIds.length === 0) {
      return { conversationId, messageIds: [] };
    }

    await this.prisma.messageHidden.createMany({
      data: foundIds.map(messageId => ({
        messageId,
        userId,
      })),
      skipDuplicates: true,
    });

    const payload = { conversationId, messageIds: foundIds };

    this.chatGateway.broadcastMessageHiddenForUser(userId, payload);

    return payload;
  }

  async markConversationUnread(
    conversationId: string,
    userId: string,
    messageId: string
  ): Promise<{
    conversationId: string;
    lastReadAt: Date | null;
    unreadAnchorMessageId: string;
    unreadCount: number;
  }> {
    await this.assertParticipant(conversationId, userId);

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
        ...this.notHiddenFilter(userId),
      },
      select: { id: true, createdAt: true },
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    const latestMessage = await this.prisma.message.findFirst({
      where: {
        conversationId,
        ...this.notHiddenFilter(userId),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true },
    });

    // Keep everything after the cursor read; only the anchored message is unread.
    const lastReadAt = latestMessage?.createdAt ?? message.createdAt;

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt,
        unreadAnchorMessageId: message.id,
        isMarkedUnread: false,
      },
    });

    const unreadCount = await countUnreadMessages(
      this.prisma,
      conversationId,
      userId,
      lastReadAt,
      message.id
    );

    return {
      conversationId,
      lastReadAt,
      unreadAnchorMessageId: message.id,
      unreadCount,
    };
  }

  async markConversationDialogUnread(
    conversationId: string,
    userId: string
  ): Promise<{
    conversationId: string;
    isMarkedUnread: boolean;
    unreadCount: number;
  }> {
    await this.assertParticipant(conversationId, userId);

    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: {
        lastReadAt: true,
        unreadAnchorMessageId: true,
        isMarkedUnread: true,
      },
    });

    if (!participant) {
      throw new ForbiddenException('Нет доступа к этому диалогу');
    }

    const unreadCount = await countUnreadMessages(
      this.prisma,
      conversationId,
      userId,
      participant.lastReadAt,
      participant.unreadAnchorMessageId
    );

    if (unreadCount > 0) {
      throw new BadRequestException(
        'Диалог уже содержит непрочитанные сообщения'
      );
    }

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        isMarkedUnread: true,
        unreadAnchorMessageId: null,
      },
    });

    return {
      conversationId,
      isMarkedUnread: true,
      unreadCount: 0,
    };
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
    options?: {
      isRedirected?: boolean;
      redirectedFromUserId?: string | null;
      redirectedFromDisplayName?: string | null;
      replyToId?: string | null;
      skipNotify?: boolean;
      skipApplicantWriteGuard?: boolean;
    },
    actorAccountId?: string
  ): Promise<ChatMessageDto> {
    const trimmedContent = content.trim();

    if (!trimmedContent && (media ?? []).length === 0) {
      throw new BadRequestException('Сообщение не может быть пустым');
    }

    await this.assertParticipant(conversationId, senderId);

    if (!options?.skipApplicantWriteGuard) {
      await this.assertApplicantMayWrite(conversationId, senderId);
    }

    const normalizedMedia = await this.prepareMessageMediaForConversation(
      conversationId,
      senderId,
      media ?? [],
      options?.isRedirected === true
    );

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
        options,
        actor
      )
    );

    if (!options?.skipNotify) {
      try {
        await this.notifyRecipientAboutMessage(
          conversationId,
          senderId,
          message,
          actor
        );
      } catch (error) {
        // Сообщение уже сохранено — не откатываем отправку из‑за сбоя notify
        this.logger.error(
          'Не удалось отправить уведомление о сообщении в чате',
          error instanceof Error ? error.stack : String(error)
        );
      }
    }

    const readState = await this.getConversationReadState(
      conversationId,
      senderId
    );

    const mappedForSender = this.mapMessage(
      message,
      senderId,
      readState.viewerLastReadAt,
      readState.peerLastReadAt
    );

    const recipientId = await this.findConversationPeerId(
      conversationId,
      senderId
    );

    if (recipientId) {
      const recipientReadState = await this.getConversationReadState(
        conversationId,
        recipientId
      );
      const mappedForRecipient = this.mapMessage(
        message,
        recipientId,
        recipientReadState.viewerLastReadAt,
        recipientReadState.peerLastReadAt
      );
      this.chatGateway.broadcastMessageToUser(
        recipientId,
        mappedForRecipient
      );
    }

    return mappedForSender;
  }

  /**
   * Keys must live under chats/{conversationId}/.
   * For forwarded messages, copy media from another chat the sender can access.
   */
  private async prepareMessageMediaForConversation(
    conversationId: string,
    userId: string,
    media: ChatMessageMediaInput[],
    allowCopyFromOtherChats: boolean
  ): Promise<ChatMessageMediaInput[]> {
    if (!media.length) {
      return [];
    }

    const expectedKeyPrefix = `chats/${conversationId}/`;
    const prepared: ChatMessageMediaInput[] = [];

    for (const item of media) {
      if (item.key.startsWith(expectedKeyPrefix)) {
        prepared.push({
          ...item,
          fileName: sanitizeUploadFileName(item.fileName),
        });
        continue;
      }

      if (!allowCopyFromOtherChats || !item.key.startsWith('chats/')) {
        throw new BadRequestException(
          'Недопустимый ключ медиа для этого диалога'
        );
      }

      const sourceConversationId = item.key.split('/')[1];

      if (!sourceConversationId || sourceConversationId === conversationId) {
        throw new BadRequestException(
          'Недопустимый ключ медиа для этого диалога'
        );
      }

      await this.assertParticipant(sourceConversationId, userId);

      const sourceMedia = await this.prisma.messageMedia.findFirst({
        where: {
          key: item.key,
          message: {
            conversationId: sourceConversationId,
            ...this.notHiddenFilter(userId),
          },
        },
        select: { id: true, mimeType: true, size: true, fileName: true },
      });

      if (!sourceMedia) {
        throw new BadRequestException(
          'Недопустимый ключ медиа для этого диалога'
        );
      }

      const extension =
        MIME_TO_EXTENSION[item.mimeType] ??
        MIME_TO_EXTENSION[sourceMedia.mimeType] ??
        item.key.split('.').pop()?.toLowerCase() ??
        'bin';
      const destKey = `chats/${conversationId}/${randomUUID()}.${extension}`;

      try {
        await this.storageService.copyObject(
          item.key,
          destKey,
          item.mimeType || sourceMedia.mimeType
        );
      } catch {
        throw new InternalServerErrorException(
          'Не удалось скопировать медиа при пересылке'
        );
      }

      prepared.push({
        url: this.storageService.getPublicUrl(destKey),
        key: destKey,
        size: item.size || sourceMedia.size,
        mimeType: item.mimeType || sourceMedia.mimeType,
        fileName:
          sanitizeUploadFileName(item.fileName) ?? sourceMedia.fileName,
      });
    }

    return prepared;
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
    const recipientId = await this.findConversationPeerId(
      conversationId,
      senderId
    );

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
        peerId: senderId,
        senderId,
        meta: {
          messageId: message.id,
          preview,
        },
      },
    });
  }

  private async findConversationPeerId(
    conversationId: string,
    userId: string
  ): Promise<string | null> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    return (
      participants
        .map(participant => participant.userId)
        .find(participantId => participantId !== userId) ?? null
    );
  }

  private async createMessageInTransaction(
    tx: PrismaTx,
    conversationId: string,
    senderId: string,
    content: string,
    media: ChatMessageMediaInput[] = [],
    options?: {
      isRedirected?: boolean;
      redirectedFromUserId?: string | null;
      redirectedFromDisplayName?: string | null;
      replyToId?: string | null;
    },
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

    const isRedirected = options?.isRedirected === true;
    let replyToId: string | null = null;
    let replyToPreview: string | null = null;
    let replyToSenderId: string | null = null;
    let replyToSenderName: string | null = null;

    if (options?.replyToId) {
      const replyTo = await tx.message.findFirst({
        where: {
          id: options.replyToId,
          conversationId,
        },
        include: {
          media: { select: { id: true }, take: 1 },
          sender: { include: userWithProfileInclude },
        },
      });

      if (!replyTo) {
        throw new BadRequestException('Сообщение для ответа не найдено');
      }

      replyToId = replyTo.id;
      replyToPreview =
        replyTo.content.trim().length > 0
          ? replyTo.content.trim().slice(0, 200)
          : replyTo.media.length > 0
            ? 'Вложение'
            : '';
      replyToSenderId = replyTo.senderId;
      replyToSenderName =
        replyTo.actorDisplayName?.trim() ||
        this.mapPeer(replyTo.sender).displayName;
    }

    const created = await tx.message.create({
      data: {
        conversationId,
        senderId,
        content: trimmedContent,
        isRedirected,
        redirectedFromUserId: isRedirected
          ? (options?.redirectedFromUserId ?? null)
          : null,
        redirectedFromDisplayName: isRedirected
          ? (options?.redirectedFromDisplayName ?? null)
          : null,
        replyToId,
        replyToPreview,
        replyToSenderId,
        replyToSenderName,
        ...this.actorAttribution.toPrismaFields(actor),
        ...(normalizedMedia.length > 0 && {
          media: {
            create: normalizedMedia.map((item, index) => ({
              url: item.url,
              key: item.key,
              size: String(item.size),
              mimeType: item.mimeType,
              fileName: sanitizeUploadFileName(item.fileName),
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

    await tx.conversationParticipant.updateMany({
      where: {
        conversationId,
        hiddenAt: { not: null },
      },
      data: { hiddenAt: null },
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

  /**
   * После отклика на объявление компании исполнитель не может писать,
   * пока компания не отправит хотя бы одно сообщение в этом диалоге.
   */
  async getSendPermission(
    conversationId: string,
    userId: string
  ): Promise<{ canSendMessages: boolean; sendBlockedReason: string | null }> {
    const blockedReason = await this.getApplicantWriteBlockReason(
      conversationId,
      userId
    );

    return {
      canSendMessages: blockedReason === null,
      sendBlockedReason: blockedReason,
    };
  }

  private async assertApplicantMayWrite(
    conversationId: string,
    senderId: string
  ): Promise<void> {
    const reason = await this.getApplicantWriteBlockReason(
      conversationId,
      senderId
    );

    if (reason) {
      throw new ForbiddenException(reason);
    }
  }

  private async getApplicantWriteBlockReason(
    conversationId: string,
    senderId: string
  ): Promise<string | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isNotes: true },
    });

    if (!conversation || conversation.isNotes) {
      return null;
    }

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    const peerId = participants
      .map(participant => participant.userId)
      .find(userId => userId !== senderId);

    if (!peerId) {
      return null;
    }

    const application = await this.prisma.postApplication.findFirst({
      where: {
        applicantId: senderId,
        post: {
          ownerId: peerId,
          owner: { role: Role.COMPANY },
        },
      },
      select: { id: true },
    });

    if (!application) {
      return null;
    }

    const companyMessage = await this.prisma.message.findFirst({
      where: {
        conversationId,
        senderId: peerId,
      },
      select: { id: true },
    });

    if (companyMessage) {
      return null;
    }

    return 'Дождитесь первого сообщения от компании';
  }

  private async mapConversation(
    conversation: {
      id: string;
      isNotes?: boolean;
      updatedAt: Date;
      participants: Array<{
        userId: string;
        lastReadAt: Date | null;
        unreadAnchorMessageId?: string | null;
        isMarkedUnread?: boolean;
        isPinned?: boolean;
        user: NonNullable<UserWithProfile>;
      }>;
      messages: Array<{
        id: string;
        conversationId: string;
        senderId: string;
        content: string;
        createdAt: Date;
        editedAt?: Date | null;
        isRedirected?: boolean;
        redirectedFromUserId?: string | null;
        redirectedFromDisplayName?: string | null;
        replyToId?: string | null;
        replyToPreview?: string | null;
        replyToSenderId?: string | null;
        replyToSenderName?: string | null;
        actorAccountId?: string | null;
        actorDisplayName?: string | null;
        actorKind?: MessageActorKind | null;
        media?: Array<{
          url: string;
          key: string;
          size: string;
          mimeType: string;
          fileName?: string | null;
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

    if (!viewerParticipant) {
      throw new NotFoundException('Собеседник не найден');
    }

    const isNotes = conversation.isNotes ?? false;
    let peer: ChatPeerDto;
    let peerLastReadAt: Date | null;

    if (isNotes) {
      peer = {
        ...this.mapPeer(viewerParticipant.user),
        displayName: 'Заметки',
      };
      peerLastReadAt = viewerParticipant.lastReadAt;
    } else if (!peerParticipant) {
      throw new NotFoundException('Собеседник не найден');
    } else {
      peer = this.mapPeer(peerParticipant.user);
      peerLastReadAt = peerParticipant.lastReadAt;
    }

    const lastMessage = conversation.messages[0];
    const viewerLastReadAt = viewerParticipant.lastReadAt;
    const unreadAnchorMessageId =
      viewerParticipant.unreadAnchorMessageId ?? null;
    const isMarkedUnread = viewerParticipant.isMarkedUnread ?? false;
    const unreadCount = await countUnreadMessages(
      this.prisma,
      conversation.id,
      userId,
      viewerLastReadAt,
      unreadAnchorMessageId
    );

    const sendPermission = await this.getSendPermission(
      conversation.id,
      userId
    );

    return {
      id: conversation.id,
      peer,
      lastMessage: lastMessage
        ? this.mapMessage(lastMessage, userId, viewerLastReadAt, peerLastReadAt)
        : null,
      unreadCount,
      unreadAnchorMessageId,
      isMarkedUnread,
      isPinned: viewerParticipant.isPinned ?? false,
      isNotes,
      canSendMessages: sendPermission.canSendMessages,
      sendBlockedReason: sendPermission.sendBlockedReason,
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
      redirectedFromUserId?: string | null;
      redirectedFromDisplayName?: string | null;
      replyToId?: string | null;
      replyToPreview?: string | null;
      replyToSenderId?: string | null;
      replyToSenderName?: string | null;
      media?: Array<{
        url: string;
        key: string;
        size: string;
        mimeType: string;
        fileName?: string | null;
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
        fileName: item.fileName ?? null,
      })),
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      isRedirected: message.isRedirected ?? false,
      redirectedFromUserId: message.redirectedFromUserId ?? null,
      redirectedFromDisplayName: message.redirectedFromDisplayName ?? null,
      replyToId: message.replyToId ?? null,
      replyToPreview: message.replyToPreview ?? null,
      replyToSenderId: message.replyToSenderId ?? null,
      replyToSenderName: message.replyToSenderName ?? null,
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
    fileName?: string | null;
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
      fileName: attachment.fileName ?? null,
      createdAt: attachment.message.createdAt,
    };
  }
}
