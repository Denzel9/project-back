import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { SubscribePushDto, UnsubscribePushDto } from './dto/push.dto';
import { PushService } from './push.service';

@ApiTags('push')
@ApiCookieAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Публичный VAPID ключ для Web Push' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        publicKey: { type: 'string', nullable: true },
        enabled: { type: 'boolean' },
      },
    },
  })
  getVapidPublicKey() {
    const publicKey = this.pushService.getPublicKey();
    return {
      publicKey,
      enabled: this.pushService.isEnabled() && Boolean(publicKey),
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Есть ли активная push-подписка у текущего профиля' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { subscribed: { type: 'boolean' } },
    },
  })
  async status(@CurrentUser() user: AuthUser) {
    return {
      subscribed: await this.pushService.hasSubscription(user.userId),
    };
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Сохранить Web Push subscription' })
  @ApiUnauthorizedResponse({ description: 'Не авторизован' })
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribePushDto
  ) {
    await this.pushService.subscribe(user.userId, dto);
    return { ok: true };
  }

  @Delete('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить Web Push subscription' })
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UnsubscribePushDto
  ) {
    await this.pushService.unsubscribe(user.userId, dto.endpoint);
  }
}
