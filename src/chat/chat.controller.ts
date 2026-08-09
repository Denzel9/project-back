import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipWriteGuard } from '../auth/guards/membership-write.guard';
import { EmailConfirmedGuard } from '../auth/guards/email-confirmed.guard';
import { AuthUser } from '../auth/auth.types';
import { ChatService } from './chat.service';
import { ChatConversationResponse } from './dto/chat-conversation.response';
import { ChatMessageResponse } from './dto/chat-message.response';
import { ChatUnreadCountDto } from './dto/chat-unread-count.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SearchMessagesQueryDto } from './dto/search-messages-query.dto';
import { SearchMessagesResponse } from './dto/search-messages-response.dto';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { ListAttachmentsResponse } from './dto/list-attachments-response.dto';
import { UpdateChatMessageDto } from './dto/update-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ChatMessagePinResponse } from './dto/chat-message-pin.response';
import { UpdateChatMessagePinDto } from './dto/update-message-pin.dto';
import {
  HideMessagesDto,
  MarkUnreadDto,
} from './dto/chat-message-actions.dto';

@ApiTags('chat')
@ApiCookieAuth('access-token')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('unread-count')
  @ApiOperation({
    summary: 'Сумма непрочитанных входящих сообщений',
    description:
      'Суммарный unreadCount по всем диалогам активного профиля ' +
      '(та же логика, что per-conversation unreadCount в списке диалогов).',
  })
  @ApiOkResponse({ type: ChatUnreadCountDto })
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.chatService.getUnreadCount(user.userId);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'Список диалогов',
    description:
      'Все 1:1 диалоги активного профиля. Для каждого: собеседник (peer), preview последнего сообщения, ' +
      '`unreadCount` (непрочитанные входящие), `isPinned`, updatedAt. ' +
      'Порядок: закреплённые, затем непрочитанные по updatedAt. ' +
      'Фильтры: `q` (имя собеседника или текст сообщений), `peerId`. ' +
      'Отправка сообщений в realtime — WebSocket /chat (событие send_message).',
  })
  @ApiOkResponse({
    description: 'Список диалогов с preview последнего сообщения',
    type: ChatConversationResponse,
    isArray: true,
  })
  listConversations(
    @CurrentUser() user: AuthUser,
    @Query() query: ListConversationsQueryDto
  ) {
    return this.chatService.listConversations(user.userId, query);
  }

  @Post('conversations')
  @UseGuards(EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Начать или открыть диалог',
    description:
      'Создаёт 1:1 диалог с recipientId или возвращает существующий. ' +
      'Нельзя написать самому себе. recipientId — userId собеседника.',
  })
  @ApiCreatedResponse({
    description: 'Диалог создан или найден существующий',
    type: ChatConversationResponse,
  })
  @ApiNotFoundResponse({ description: 'Получатель не найден' })
  @ApiForbiddenResponse({ description: 'Нельзя создать диалог с самим собой' })
  createConversation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto
  ) {
    return this.chatService.findOrCreateConversation(
      user.userId,
      dto.recipientId
    );
  }

  @Patch('conversations/:id')
  @ApiOperation({
    summary: 'Закрепить или открепить диалог',
    description:
      'Персональное закрепление для текущего пользователя. ' +
      'Закреплённые диалоги отображаются выше в списке контактов.',
  })
  @ApiOkResponse({
    description: 'Обновлённый диалог',
    type: ChatConversationResponse,
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к диалогу' })
  updateConversation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: UpdateConversationDto
  ) {
    return this.chatService.updateConversationPin(
      conversationId,
      user.userId,
      dto.isPinned
    );
  }

  @Get('conversations/:id/messages/search')
  @ApiOperation({
    summary: 'Поиск сообщений в диалоге',
    description:
      'Поиск по тексту content (без учёта регистра). Пагинация page/limit. ' +
      'Сообщения возвращаются с media[]. Только для участников диалога.',
  })
  @ApiOkResponse({
    description: 'Найденные сообщения с пагинацией',
    type: SearchMessagesResponse,
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к диалогу' })
  searchMessages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: SearchMessagesQueryDto
  ) {
    return this.chatService.searchMessages(conversationId, user.userId, query);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: 'История сообщений',
    description:
      'Сообщения диалога с cursor-пагинацией (от новых к старым). ' +
      'Каждое сообщение содержит media[] и isRead (для входящих — прочитано вами; для исходящих — собеседником). ' +
      'Без cursor по умолчанию markRead=true (диалог отмечается прочитанным). ' +
      'cursor — id сообщения, limit по умолчанию 50. Только для участников диалога.',
  })
  @ApiOkResponse({
    description: 'Массив сообщений (хронологический порядок в ответе)',
    type: ChatMessageResponse,
    isArray: true,
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к диалогу' })
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: ListMessagesQueryDto
  ) {
    return this.chatService.listMessages(
      conversationId,
      user.userId,
      query.cursor,
      query.limit,
      query.markRead ?? (query.cursor ? false : undefined)
    );
  }

  @Patch('conversations/:id/messages/:messageId/pin')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Закрепить или открепить сообщение',
    description:
      'Закреплённые сообщения общие для всех участников диалога. ' +
      'Текст превью и счетчик вложений используются в верхней строке диалога.',
  })
  @ApiNoContentResponse({ description: 'Готово' })
  @ApiForbiddenResponse({ description: 'Нет доступа к диалогу' })
  @ApiNotFoundResponse({ description: 'Сообщение не найдено' })
  pinMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateChatMessagePinDto
  ) {
    return this.chatService.pinMessage(
      conversationId,
      messageId,
      user.userId,
      dto.isPinned
    );
  }

  @Get('conversations/:id/messages/pins')
  @ApiOperation({
    summary: 'Список закреплённых сообщений диалога',
    description: 'Возвращает закреплённые сообщения по pinnedAt DESC.',
  })
  @ApiOkResponse({
    description: 'Массив закреплённых сообщений',
    type: ChatMessagePinResponse,
    isArray: true,
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к диалогу' })
  listMessagePins(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.chatService.listMessagePins(
      conversationId,
      user.userId,
      parsedLimit ?? 50
    );
  }

  @Patch('conversations/:id/messages/:messageId')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Редактировать сообщение',
    description:
      'Меняет только текст (`content`). Вложения не редактируются. Только отправитель. ' +
      'Текст может быть пустым, если у сообщения есть media[]. ' +
      'Участники диалога получат событие message_edited по WebSocket.',
  })
  @ApiOkResponse({
    type: ChatMessageResponse,
    description: 'Обновлённое сообщение',
  })
  @ApiNotFoundResponse({ description: 'Сообщение не найдено' })
  @ApiForbiddenResponse({
    description: 'Нет доступа к диалогу или сообщение не ваше',
  })
  @ApiBadRequestResponse({ description: 'Пустой текст у сообщения без вложений' })
  updateMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateChatMessageDto
  ) {
    return this.chatService.updateMessage(
      conversationId,
      user.userId,
      messageId,
      dto.content
    );
  }

  @Delete('conversations/:id/messages/:messageId')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Скрыть сообщение у себя',
    description:
      'Удаляет сообщение только у текущего пользователя (MessageHidden). ' +
      'У собеседника сообщение остаётся.',
  })
  @ApiNoContentResponse({ description: 'Сообщение скрыто' })
  @ApiNotFoundResponse({ description: 'Сообщение не найдено' })
  @ApiForbiddenResponse({
    description: 'Нет доступа к диалогу',
  })
  removeMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string
  ) {
    return this.chatService.removeMessage(
      conversationId,
      user.userId,
      messageId
    );
  }

  @Post('conversations/:id/messages/hide')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Скрыть несколько сообщений у себя',
  })
  @ApiOkResponse({
    description: 'Скрытые messageIds',
    schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', format: 'uuid' },
        messageIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      },
    },
  })
  hideMessages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: HideMessagesDto
  ) {
    return this.chatService.hideMessages(
      conversationId,
      user.userId,
      dto.messageIds
    );
  }

  @Post('conversations/:id/mark-unread')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Пометить одно сообщение непрочитанным',
    description:
      'Ставит якорь на указанное сообщение и lastReadAt на последнее видимое. ' +
      'Непрочитанным считается только это сообщение (плюс новые после lastReadAt).',
  })
  markConversationUnread(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: MarkUnreadDto
  ) {
    return this.chatService.markConversationUnread(
      conversationId,
      user.userId,
      dto.messageId
    );
  }

  @Post('conversations/:id/mark-dialog-unread')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Пометить диалог непрочитанным',
    description:
      'Только метка чата (точка в списке). Сообщения не становятся непрочитанными. ' +
      'Доступно, если в диалоге нет непрочитанных сообщений.',
  })
  markConversationDialogUnread(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string
  ) {
    return this.chatService.markConversationDialogUnread(
      conversationId,
      user.userId
    );
  }

  @Get('notes')
  @ApiOperation({
    summary: 'Открыть или создать диалог «Заметки»',
  })
  @ApiOkResponse({ type: ChatConversationResponse })
  getNotes(@CurrentUser() user: AuthUser) {
    return this.chatService.findOrCreateNotesConversation(user.userId);
  }

  @Post('notes')
  @UseGuards(EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Создать или вернуть диалог «Заметки»',
  })
  @ApiCreatedResponse({ type: ChatConversationResponse })
  createNotes(@CurrentUser() user: AuthUser) {
    return this.chatService.findOrCreateNotesConversation(user.userId);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Отметить диалог прочитанным',
    description:
      'Обновляет lastReadAt до времени последнего сообщения. ' +
      'Собеседник получит событие messages_read по WebSocket.',
  })
  @ApiOkResponse({
    description: 'Диалог отмечен прочитанным',
    schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', format: 'uuid' },
        readAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к диалогу' })
  async markConversationRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string
  ) {
    const readAt = await this.chatService.markConversationAsRead(
      conversationId,
      user.userId
    );

    return {
      conversationId,
      readAt: readAt.toISOString(),
    };
  }

  @Get('conversations/:id/attachments')
  @ApiOperation({
    summary: 'Все вложения диалога',
    description:
      'Список всех вложений (фото, видео, документы) в диалоге. ' +
      'Опциональный фильтр type=image|video|document. Пагинация page/limit. Только для участников.',
  })
  @ApiOkResponse({
    description:
      'Вложения с контекстом сообщения (messageId, senderId, createdAt)',
    type: ListAttachmentsResponse,
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к диалогу' })
  listAttachments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: ListAttachmentsQueryDto
  ) {
    return this.chatService.listAttachments(conversationId, user.userId, query);
  }
}
