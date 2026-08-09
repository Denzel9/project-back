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
import { AuthUser, JwtPayload } from '../auth/auth.types';
import { extractAccessTokenFromHandshake } from '../chat/ws-auth.util';
import { TasksService } from './tasks.service';
import {
  CommentDeletedPayload,
  CommentsReadPayload,
  DeleteCommentPayload,
  EditCommentPayload,
  JoinTaskPayload,
  MarkCommentsReadPayload,
  SendCommentPayload,
  TaskCommentDto,
  TaskCommentsErrorPayload,
} from './task-comments.types';

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
  namespace: '/task-comments',
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
})
export class TaskCommentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TaskCommentsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    private readonly membershipService: AccountMembershipService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
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
    } catch {
      this.emitError(client, 'Неверный access-токен');
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_task')
  async joinTask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinTaskPayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.tasksService.assertTaskParticipant(payload.taskId, user.userId);
      await client.join(this.getRoomName(payload.taskId));
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('send_comment')
  async sendComment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendCommentPayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.membershipService.assertCanWrite(user.accountId, user.userId);

      await this.tasksService.createComment(this.toAuthUser(user), payload.taskId, {
        content: payload.content,
        media: payload.media,
        replyToId: payload.replyToId,
      });

      await client.join(this.getRoomName(payload.taskId));
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('edit_comment')
  async editComment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: EditCommentPayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.membershipService.assertCanWrite(user.accountId, user.userId);

      await this.tasksService.updateComment(
        this.toAuthUser(user),
        payload.taskId,
        payload.commentId,
        { content: payload.content }
      );

      await client.join(this.getRoomName(payload.taskId));
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('delete_comment')
  async deleteComment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteCommentPayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.membershipService.assertCanWrite(user.accountId, user.userId);

      await this.tasksService.deleteComment(
        this.toAuthUser(user),
        payload.taskId,
        payload.commentId
      );

      await client.join(this.getRoomName(payload.taskId));
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('mark_comments_read')
  async markCommentsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkCommentsReadPayload
  ) {
    const user = client.data.user;

    if (!user) {
      this.emitError(client, 'Не авторизован');
      client.disconnect();
      return;
    }

    try {
      await this.tasksService.markTaskCommentsAsRead(
        payload.taskId,
        user.userId
      );

      await client.join(this.getRoomName(payload.taskId));
    } catch (error) {
      this.emitError(client, this.getErrorMessage(error));
    }
  }

  broadcastComment(taskId: string, comment: TaskCommentDto): void {
    this.server.to(this.getRoomName(taskId)).emit('comment', comment);
  }

  broadcastCommentEdited(taskId: string, comment: TaskCommentDto): void {
    this.server.to(this.getRoomName(taskId)).emit('comment_edited', comment);
  }

  broadcastCommentDeleted(
    taskId: string,
    payload: CommentDeletedPayload
  ): void {
    this.server.to(this.getRoomName(taskId)).emit('comment_deleted', payload);
  }

  broadcastCommentsRead(taskId: string, payload: CommentsReadPayload): void {
    this.server.to(this.getRoomName(taskId)).emit('comments_read', payload);
  }

  private getRoomName(taskId: string): string {
    return `task:${taskId}`;
  }

  private toAuthUser(user: NonNullable<AuthenticatedSocket['data']['user']>): AuthUser {
    return {
      userId: user.userId,
      accountId: user.accountId,
      email: user.email,
      role: user.role,
      membershipRole: user.membershipRole,
    };
  }

  private emitError(client: AuthenticatedSocket, message: string) {
    const payload: TaskCommentsErrorPayload = { message };
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
