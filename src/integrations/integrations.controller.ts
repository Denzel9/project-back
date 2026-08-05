import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MessengerProvider } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import {
  IntegrationLinkResponseDto,
  IntegrationsStatusResponseDto,
} from './dto/integrations-response.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('telegram/webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook Telegram Bot API' })
  async telegramWebhook(
    @Req() req: Request,
    @Headers('x-telegram-bot-api-secret-token') secret?: string
  ) {
    if (!this.integrationsService.isTelegramWebhookSecretValid(secret)) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    const update = req.body as {
      message?: {
        text?: string;
        chat?: { id?: number | string };
        from?: { id?: number | string; username?: string };
      };
    };

    const text = update.message?.text?.trim() ?? '';
    const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
    const token = startMatch?.[1]?.trim();

    if (
      token &&
      update.message?.chat?.id !== undefined &&
      update.message?.from?.id !== undefined
    ) {
      await this.integrationsService.bindFromWebhook({
        provider: MessengerProvider.TELEGRAM,
        token,
        chatId: String(update.message.chat.id),
        externalUserId: String(update.message.from.id),
        username: update.message.from.username ?? null,
      });
    }

    return { ok: true };
  }

  @Post('max/webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook MAX Bot API' })
  async maxWebhook(
    @Req() req: Request,
    @Headers('x-max-bot-api-secret') secret?: string
  ) {
    if (!this.integrationsService.isMaxWebhookSecretValid(secret)) {
      throw new UnauthorizedException('Invalid MAX webhook secret');
    }

    const update = req.body as {
      update_type?: string;
      payload?: string | null;
      chat_id?: number | string;
      user?: {
        user_id?: number | string;
        username?: string;
      };
    };

    if (
      update.update_type === 'bot_started' &&
      update.payload &&
      update.chat_id !== undefined &&
      update.user?.user_id !== undefined
    ) {
      await this.integrationsService.bindFromWebhook({
        provider: MessengerProvider.MAX,
        token: String(update.payload).trim(),
        chatId: String(update.chat_id),
        externalUserId: String(update.user.user_id),
        username: update.user.username ?? null,
      });
    }

    return { ok: true };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access-token')
  @ApiOperation({ summary: 'Статус интеграций Telegram и MAX' })
  @ApiOkResponse({ type: IntegrationsStatusResponseDto })
  getStatus(@CurrentUser() user: AuthUser) {
    return this.integrationsService.getStatus(user);
  }

  @Post(':provider/link')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access-token')
  @ApiOperation({
    summary: 'Создать deep-link для подключения мессенджера',
  })
  @ApiParam({ name: 'provider', enum: MessengerProvider })
  @ApiOkResponse({ type: IntegrationLinkResponseDto })
  createLink(
    @CurrentUser() user: AuthUser,
    @Param('provider') providerRaw: string
  ) {
    const provider = this.integrationsService.parseProvider(providerRaw);
    return this.integrationsService.createLink(user, provider);
  }

  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access-token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Отвязать мессенджер' })
  @ApiParam({ name: 'provider', enum: MessengerProvider })
  async unlink(
    @CurrentUser() user: AuthUser,
    @Param('provider') providerRaw: string
  ) {
    const provider = this.integrationsService.parseProvider(providerRaw);
    await this.integrationsService.unlink(user, provider);
  }
}
