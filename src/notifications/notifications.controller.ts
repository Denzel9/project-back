import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NotificationResponseDto,
  NotificationUnreadCountDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiCookieAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Список уведомлений',
    description:
      'Inbox активного профиля. Фильтры: `read` (true/false), `type`. Сортировка — от новых к старым.',
  })
  @ApiOkResponse({ description: 'Список уведомлений с пагинацией' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQueryDto
  ) {
    return this.notificationsService.list(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Число непрочитанных уведомлений' })
  @ApiOkResponse({ type: NotificationUnreadCountDto })
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Пометить все уведомления прочитанными' })
  @ApiOkResponse({
    description: 'Количество обновлённых записей',
    schema: {
      type: 'object',
      properties: { updated: { type: 'number' } },
    },
  })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Пометить уведомление прочитанным' })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundResponse({ description: 'Уведомление не найдено' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.notificationsService.markRead(user, id);
  }
}
