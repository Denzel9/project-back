import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, Prisma } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChatConversationDto,
  ChatAttachmentDto,
  ChatMessageDto,
  ChatMessageMediaInput,
  ChatPeerDto,
} from './chat.types';
import { SearchMessagesQueryDto } from './dto/search-messages-query.dto';
import {
  AttachmentTypeFilter,
  ListAttachmentsQueryDto,
} from './dto/list-attachments-query.dto';

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

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService
  ) {}

  async listConversations(userId: string): Promise<ChatConversationDto[]> {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
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
      orderBy: {
        conversation: {
          updatedAt: 'desc',
        },
      },
    });

    return participations.map(({ conversation }) => {
      const peerParticipant = conversation.participants.find(
        (participant) => participant.userId !== userId
      );

      if (!peerParticipant) {
        throw new NotFoundException('Собеседник не найден');
      }

      const lastMessage = conversation.messages[0];

      return {
        id: conversation.id,
        peer: this.mapPeer(peerParticipant.user),
        lastMessage: lastMessage ? this.mapMessage(lastMessage) : null,
        updatedAt: conversation.updatedAt,
      };
    });
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

    this.assertOppositeRoles(currentUser.role, recipient.role);

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

  async listMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50
  ): Promise<ChatMessageDto[]> {
    await this.assertParticipant(conversationId, userId);

    const cursorMessage = cursor
      ? await this.prisma.message.findUnique({
          where: { id: cursor },
        })
      : null;

    if (cursor && (!cursorMessage || cursorMessage.conversationId !== conversationId)) {
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

    return messages.reverse().map((message) => this.mapMessage(message));
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
      items: messages.map((message) => this.mapMessage(message)),
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
      items: attachments.map((attachment) => this.mapAttachment(attachment)),
      total,
      page,
      limit,
    };
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    content = '',
    media: ChatMessageMediaInput[] = []
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
        throw new BadRequestException('Недопустимый ключ медиа для этого диалога');
      }
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId,
          content: trimmedContent,
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
    });

    return this.mapMessage(message);
  }

  async assertParticipant(conversationId: string, userId: string): Promise<void> {
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

  private assertOppositeRoles(currentRole: Role, recipientRole: Role): void {
    if (currentRole === recipientRole) {
      throw new BadRequestException(
        'Диалог возможен только между креатором и компанией'
      );
    }
  }

  private mapConversation(
    conversation: {
      id: string;
      updatedAt: Date;
      participants: Array<{
        userId: string;
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
  ): ChatConversationDto {
    const peerParticipant = conversation.participants.find(
      (participant) => participant.userId !== userId
    );

    if (!peerParticipant) {
      throw new NotFoundException('Собеседник не найден');
    }

    const lastMessage = conversation.messages[0];

    return {
      id: conversation.id,
      peer: this.mapPeer(peerParticipant.user),
      lastMessage: lastMessage ? this.mapMessage(lastMessage) : null,
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

  private mapMessage(message: {
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
  }): ChatMessageDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      media: (message.media ?? []).map((item) => ({
        url: item.url,
        key: item.key,
        size: item.size,
        mimeType: item.mimeType,
      })),
      createdAt: message.createdAt,
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
