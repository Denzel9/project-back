import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { UpdateUserConfigDto } from './dto/update-user-config.dto';
import { UserConfigResponseDto } from './dto/user-config-response.dto';
import { UserConfigService } from './user-config.service';

@ApiTags('config')
@ApiCookieAuth('access-token')
@Controller('config')
@UseGuards(JwtAuthGuard)
export class UserConfigController {
  constructor(private readonly userConfigService: UserConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Конфиг активного профиля',
    description:
      'Создаётся с дефолтами при первом запросе. ' +
      '`inAppNotificationTypes` — whitelist in-app; `emailNotificationTypes` — whitelist email; ' +
      '`telegramNotificationTypes` / `maxNotificationTypes` — мессенджеры; ' +
      '`dashboardTiles` / `dashboardShow*` — настройки дашборда CRM.',
  })
  @ApiOkResponse({ type: UserConfigResponseDto })
  get(@CurrentUser() user: AuthUser) {
    return this.userConfigService.getOrCreate(user);
  }

  @Patch()
  @ApiOperation({
    summary: 'Обновить конфиг',
    description:
      'Partial update: уведомления (`inAppNotificationTypes`, `emailNotificationTypes`, ' +
      '`telegramNotificationTypes`, `maxNotificationTypes`) ' +
      'и/или дашборд (`dashboardTiles`, `dashboardShowTasks|Activity|Comments|Calendar|Chats`). ' +
      'Массивы — полная замена. Пустой `dashboardTiles` скрывает все плитки. ' +
      'Для CHAT_MESSAGE email/мессенджеры дополнительно: только offline + throttle.',
  })
  @ApiOkResponse({ type: UserConfigResponseDto })
  @ApiBadRequestResponse({ description: 'Не передано ни одного поля' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserConfigDto) {
    return this.userConfigService.update(user, dto);
  }
}
