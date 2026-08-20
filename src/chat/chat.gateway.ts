import { Inject, Logger, HttpException, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MembershipRole, Role } from '@prisma/client';
import { AccountMembershipService } from '../accounts/account-membership.service';
import { JwtPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import {
  ChatErrorPayload,
  ChatMessageDto,
  ChatPresencePayload,
  DeleteMessagePayload,
  EditMessagePayload,
  JoinConversationPayload,
  MarkReadPayload,
  MessageDeletedPayload,
  MessagesReadPayload,
  SendMessagePayload,
} from './chat.types';
import { extractAccessTokenFromHandshake } from './ws-auth.util';

type AuthenticatedSocket = Socket & {
  data: {
    user?: {
      userId: string;
      accountId: string;
      email: string;
      role: Role;
      membershipRole: MembershipRole;
    };
  };
};

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly membershipService: AccountMembershipService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = extractAccessTokenFromHandshake({
        headers: client.handshake.headers,
        auth: client.handshake.auth as { token?: string },
      });

      if (!token) {
        this.emitError(client, 'Отсутствует access-токен');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      client.data.user = {
        userId: payload.sub,
        accountId: payload.accountId,
        email: payload.email,
        role: payload.role,
        membershipRole: payload.membershipRole,
      };

      await client.join(`user:${payload.sub}`);

      const alreadyOnline = await this.isUserConnected(payload.sub, client.id);

      if (!alreadyOnline) {
        await this.broadcastPresence(payload.sub, true, null);
      }
    } catch {
      this.emitError(client, 'Неверный access-токен');
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Client disconnected: ${client.id}`);

    const userId = client.data.user?.userId;

    if (!userId) {
      return;
    }

    const lastSeenAt = new Date();

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist lastSeenAt for ${userId}: ${this.getErrorMessage(error)}`
      );
    }

    const stillOnline = await this.isUserConnected(userId, client.id);

    if (!stillOnline) {
      await this.broadcastPresence(userId, false, lastSeenAt.toISOString());
    }
  }

  @SubscribeMessage('join_conversation')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinConversationPayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.chatService.assertParticipant(
        payload.conversationId,
        user.userId
      );
      await client.join(this.getRoomName(payload.conversationId));
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.membershipService.assertCanChat(user.accountId, user.userId);
      await this.assertEmailConfirmed(user.userId);

      const message = await this.chatService.createMessage(
        payload.conversationId,
        user.userId,
        payload.content ?? '',
        payload.media ?? [],
        {
          isRedirected: payload.isRedirected === true,
          redirectedFromUserId: payload.redirectedFromUserId ?? null,
          redirectedFromDisplayName:
            payload.redirectedFromDisplayName ?? null,
          replyToId: payload.replyToId ?? null,
        },
        user.accountId
      );

      await client.join(this.getRoomName(payload.conversationId));

      this.broadcastMessage(payload.conversationId, message);
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('mark_read')
  async markRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkReadPayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.chatService.markConversationAsRead(
        payload.conversationId,
        user.userId
      );

      await client.join(this.getRoomName(payload.conversationId));
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('edit_message')
  async editMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: EditMessagePayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.membershipService.assertCanChat(user.accountId, user.userId);
      await this.assertEmailConfirmed(user.userId);

      await this.chatService.updateMessage(
        payload.conversationId,
        user.userId,
        payload.messageId,
        payload.content
      );

      await client.join(this.getRoomName(payload.conversationId));
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('delete_message')
  async deleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteMessagePayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.membershipService.assertCanChat(user.accountId, user.userId);
      await this.assertEmailConfirmed(user.userId);

      await this.chatService.removeMessage(
        payload.conversationId,
        user.userId,
        payload.messageId
      );

      await client.join(this.getRoomName(payload.conversationId));
      client.emit('messages_hidden', {
        conversationId: payload.conversationId,
        messageIds: [payload.messageId],
      });
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  broadcastMessage(conversationId: string, message: ChatMessageDto): void {
    this.server.to(this.getRoomName(conversationId)).emit('message', message);
  }

  broadcastMessageToUser(userId: string, message: ChatMessageDto): void {
    this.server.to(this.getUserRoomName(userId)).emit('message', message);
  }

  broadcastMessagesRead(
    conversationId: string,
    payload: MessagesReadPayload
  ): void {
    this.server
      .to(this.getRoomName(conversationId))
      .emit('messages_read', payload);
  }

  broadcastMessageDeleted(
    conversationId: string,
    payload: MessageDeletedPayload
  ): void {
    this.server
      .to(this.getRoomName(conversationId))
      .emit('message_deleted', payload);
  }

  broadcastMessageEdited(
    conversationId: string,
    message: ChatMessageDto
  ): void {
    this.server
      .to(this.getRoomName(conversationId))
      .emit('message_edited', message);
  }

  broadcastMessageHiddenForUser(
    userId: string,
    payload: { conversationId: string; messageIds: string[] }
  ): void {
    this.server.to(this.getUserRoomName(userId)).emit('messages_hidden', payload);
  }

  async isUserConnected(userId: string, excludeSocketId?: string): Promise<boolean> {
    try {
      const sockets = await this.server
        .in(this.getUserRoomName(userId))
        .fetchSockets();

      return sockets.some(socket => socket.id !== excludeSocketId);
    } catch {
      return false;
    }
  }

  private async broadcastPresence(
    userId: string,
    isOnline: boolean,
    lastSeenAt: string | null
  ) {
    const payload: ChatPresencePayload = { userId, isOnline, lastSeenAt };

    this.server.to(this.getUserRoomName(userId)).emit('presence', payload);

    try {
      const conversations = await this.prisma.conversation.findMany({
        where: {
          participants: { some: { userId } },
        },
        select: {
          id: true,
          isNotes: true,
          participants: {
            where: { userId: { not: userId } },
            select: { userId: true },
          },
        },
      });

      for (const conversation of conversations) {
        this.server
          .to(this.getRoomName(conversation.id))
          .emit('presence', payload);

        if (conversation.isNotes) {
          continue;
        }

        for (const participant of conversation.participants) {
          this.server
            .to(this.getUserRoomName(participant.userId))
            .emit('presence', payload);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to broadcast presence for ${userId}: ${this.getErrorMessage(error)}`
      );
    }
  }

  private getRoomName(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private getUserRoomName(userId: string): string {
    return `user:${userId}`;
  }

  private async assertEmailConfirmed(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isEmailConfirmed: true },
    });

    if (!user?.isEmailConfirmed) {
      throw new HttpException(
        'Подтвердите почту, чтобы получить полный доступ',
        403
      );
    }
  }

  private emitError(client: AuthenticatedSocket, message: string) {
    const payload: ChatErrorPayload = { message };
    client.emit('error', payload);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message[0] : message;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Неизвестная ошибка';
  }
}
