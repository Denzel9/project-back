import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessengerConnectionStatus,
  MessengerProvider,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SendToUserInput = {
  userId: string;
  provider: MessengerProvider;
  text: string;
};

type SendToChatInput = {
  provider: MessengerProvider;
  chatId: string;
  text: string;
};

@Injectable()
export class MessengerDeliveryService {
  private readonly logger = new Logger(MessengerDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  isConfigured(provider: MessengerProvider): boolean {
    if (provider === MessengerProvider.TELEGRAM) {
      return Boolean(
        this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim() &&
          this.configService.get<string>('TELEGRAM_BOT_USERNAME')?.trim()
      );
    }

    return Boolean(
      this.configService.get<string>('MAX_BOT_TOKEN')?.trim() &&
        this.configService.get<string>('MAX_BOT_USERNAME')?.trim()
    );
  }

  async sendToUser(input: SendToUserInput): Promise<void> {
    if (!this.isConfigured(input.provider)) {
      return;
    }

    const connection = await this.prisma.messengerConnection.findUnique({
      where: {
        userId_provider: {
          userId: input.userId,
          provider: input.provider,
        },
      },
    });

    if (
      !connection ||
      connection.status !== MessengerConnectionStatus.ACTIVE
    ) {
      return;
    }

    await this.sendToChat({
      provider: input.provider,
      chatId: connection.chatId,
      text: input.text,
    });
  }

  async sendToChat(input: SendToChatInput): Promise<void> {
    if (input.provider === MessengerProvider.TELEGRAM) {
      await this.sendTelegram(input.chatId, input.text);
      return;
    }

    await this.sendMax(input.chatId, input.text);
  }

  private async sendTelegram(chatId: string, text: string): Promise<void> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim();
    if (!token) {
      return;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`Telegram sendMessage failed: ${response.status} ${body}`);
    }
  }

  private async sendMax(chatId: string, text: string): Promise<void> {
    const token = this.configService.get<string>('MAX_BOT_TOKEN')?.trim();
    if (!token) {
      return;
    }

    const url = new URL('https://platform-api2.max.ru/messages');
    url.searchParams.set('chat_id', chatId);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`MAX sendMessage failed: ${response.status} ${body}`);
    }
  }
}
