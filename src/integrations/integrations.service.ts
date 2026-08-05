import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessengerConnectionStatus,
  MessengerProvider,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  IntegrationLinkResponseDto,
  IntegrationProviderStatusDto,
  IntegrationsStatusResponseDto,
} from './dto/integrations-response.dto';
import { MessengerDeliveryService } from './messenger-delivery.service';

const LINK_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly delivery: MessengerDeliveryService
  ) {}

  async getStatus(user: AuthUser): Promise<IntegrationsStatusResponseDto> {
    const connections = await this.prisma.messengerConnection.findMany({
      where: {
        userId: user.userId,
        status: MessengerConnectionStatus.ACTIVE,
      },
    });

    const byProvider = new Map(
      connections.map(connection => [connection.provider, connection])
    );

    return {
      providers: [
        this.toProviderStatus(MessengerProvider.TELEGRAM, byProvider.get(MessengerProvider.TELEGRAM)),
        this.toProviderStatus(MessengerProvider.MAX, byProvider.get(MessengerProvider.MAX)),
      ],
    };
  }

  async createLink(
    user: AuthUser,
    provider: MessengerProvider
  ): Promise<IntegrationLinkResponseDto> {
    this.assertProviderConfigured(provider);

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);

    await this.prisma.messengerLinkToken.create({
      data: {
        token,
        userId: user.userId,
        provider,
        expiresAt,
      },
    });

    return {
      provider,
      url: this.buildDeepLink(provider, token),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async unlink(user: AuthUser, provider: MessengerProvider): Promise<void> {
    const existing = await this.prisma.messengerConnection.findUnique({
      where: {
        userId_provider: {
          userId: user.userId,
          provider,
        },
      },
    });

    if (!existing || existing.status !== MessengerConnectionStatus.ACTIVE) {
      throw new NotFoundException('Интеграция не подключена');
    }

    await this.prisma.messengerConnection.update({
      where: { id: existing.id },
      data: { status: MessengerConnectionStatus.REVOKED },
    });
  }

  async bindFromWebhook(input: {
    provider: MessengerProvider;
    token: string;
    chatId: string;
    externalUserId: string;
    username?: string | null;
  }): Promise<boolean> {
    const link = await this.prisma.messengerLinkToken.findUnique({
      where: { token: input.token },
    });

    if (
      !link ||
      link.provider !== input.provider ||
      link.usedAt !== null ||
      link.expiresAt.getTime() < Date.now()
    ) {
      this.logger.warn(
        `Invalid or expired link token for ${input.provider}`
      );
      return false;
    }

    await this.prisma.$transaction(async tx => {
      await tx.messengerLinkToken.update({
        where: { id: link.id },
        data: { usedAt: new Date() },
      });

      const existingByChat = await tx.messengerConnection.findUnique({
        where: {
          provider_chatId: {
            provider: input.provider,
            chatId: input.chatId,
          },
        },
      });

      if (existingByChat && existingByChat.userId !== link.userId) {
        await tx.messengerConnection.update({
          where: { id: existingByChat.id },
          data: { status: MessengerConnectionStatus.REVOKED },
        });
      }

      await tx.messengerConnection.upsert({
        where: {
          userId_provider: {
            userId: link.userId,
            provider: input.provider,
          },
        },
        create: {
          userId: link.userId,
          provider: input.provider,
          externalUserId: input.externalUserId,
          chatId: input.chatId,
          username: input.username ?? null,
          status: MessengerConnectionStatus.ACTIVE,
          linkedAt: new Date(),
        },
        update: {
          externalUserId: input.externalUserId,
          chatId: input.chatId,
          username: input.username ?? null,
          status: MessengerConnectionStatus.ACTIVE,
          linkedAt: new Date(),
        },
      });
    });

    try {
      await this.delivery.sendToChat({
        provider: input.provider,
        chatId: input.chatId,
        text: 'Nikssens подключён. Вы будете получать уведомления о задачах, откликах и сообщениях здесь.',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send welcome message via ${input.provider}: ${String(error)}`
      );
    }

    return true;
  }

  parseProvider(raw: string): MessengerProvider {
    const normalized = raw.trim().toUpperCase();
    if (normalized === MessengerProvider.TELEGRAM) {
      return MessengerProvider.TELEGRAM;
    }
    if (normalized === MessengerProvider.MAX) {
      return MessengerProvider.MAX;
    }
    throw new BadRequestException('Неизвестный провайдер');
  }

  isTelegramWebhookSecretValid(headerValue?: string): boolean {
    const expected = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET')?.trim();
    if (!expected) {
      return true;
    }
    return headerValue === expected;
  }

  isMaxWebhookSecretValid(headerValue?: string): boolean {
    const expected = this.configService.get<string>('MAX_WEBHOOK_SECRET')?.trim();
    if (!expected) {
      return true;
    }
    return headerValue === expected;
  }

  private toProviderStatus(
    provider: MessengerProvider,
    connection?: {
      username: string | null;
      linkedAt: Date;
      status: MessengerConnectionStatus;
    }
  ): IntegrationProviderStatusDto {
    const configured = this.delivery.isConfigured(provider);
    const connected =
      configured &&
      connection?.status === MessengerConnectionStatus.ACTIVE;

    return {
      provider,
      configured,
      connected: Boolean(connected),
      username: connected ? connection?.username ?? null : null,
      linkedAt: connected ? connection?.linkedAt.toISOString() ?? null : null,
    };
  }

  private assertProviderConfigured(provider: MessengerProvider): void {
    if (!this.delivery.isConfigured(provider)) {
      throw new ServiceUnavailableException(
        provider === MessengerProvider.TELEGRAM
          ? 'Telegram-бот не настроен на сервере'
          : 'MAX-бот не настроен на сервере'
      );
    }
  }

  private buildDeepLink(provider: MessengerProvider, token: string): string {
    if (provider === MessengerProvider.TELEGRAM) {
      const username = this.configService
        .getOrThrow<string>('TELEGRAM_BOT_USERNAME')
        .replace(/^@/, '')
        .trim();
      return `https://t.me/${username}?start=${token}`;
    }

    const username = this.configService
      .getOrThrow<string>('MAX_BOT_USERNAME')
      .replace(/^@/, '')
      .trim();
    return `https://max.ru/${username}?start=${token}`;
  }
}
