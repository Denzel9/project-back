import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { MembershipRole, Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/auth.types';
import { extractAccessTokenFromHandshake } from '../chat/ws-auth.util';
import { buildSocketCorsOrigin } from '../common/cors';
import { NotificationResponseDto } from './dto/notification-response.dto';

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
  namespace: '/notifications',
  cors: {
    origin: buildSocketCorsOrigin(),
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
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
        client.emit('error', { message: 'Отсутствует access-токен' });
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

      await client.join(this.getUserRoomName(payload.sub));
    } catch {
      client.emit('error', { message: 'Неверный access-токен' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  broadcastNotification(
    recipientId: string,
    notification: NotificationResponseDto,
    unreadCount: number
  ): void {
    this.server.to(this.getUserRoomName(recipientId)).emit('notification', {
      notification,
      unreadCount,
    });
  }

  /** Пользователь подключён к namespace `/notifications` (хотя бы одна вкладка). */
  isUserConnected(userId: string): Promise<boolean> {
    return this.server
      .in(this.getUserRoomName(userId))
      .fetchSockets()
      .then(sockets => sockets.length > 0)
      .catch(() => false);
  }

  private getUserRoomName(userId: string): string {
    return `user:${userId}`;
  }
}
