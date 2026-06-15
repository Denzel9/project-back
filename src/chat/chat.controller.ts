import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { ChatService } from './chat.service';
import { ChatConversationResponse } from './dto/chat-conversation.response';
import { ChatMessageResponse } from './dto/chat-message.response';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SearchMessagesQueryDto } from './dto/search-messages-query.dto';
import { SearchMessagesResponse } from './dto/search-messages-response.dto';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { ListAttachmentsResponse } from './dto/list-attachments-response.dto';

@ApiTags('chat')
@ApiCookieAuth('access-token')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'Список диалогов',
    description:
      'Все 1:1 диалоги активного профиля. Для каждого: собеседник (peer), preview последнего сообщения, updatedAt. ' +
      'Отправка сообщений в realtime — WebSocket /chat (событие send_message).',
  })
  @ApiOkResponse({
    description: 'Список диалогов с preview последнего сообщения',
    type: ChatConversationResponse,
    isArray: true,
  })
  listConversations(@CurrentUser() user: AuthUser) {
    return this.chatService.listConversations(user.userId);
  }

  @Post('conversations')
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
      'Каждое сообщение содержит media[] (фото/видео). ' +
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
      query.limit
    );
  }

  @Get('conversations/:id/attachments')
  @ApiOperation({
    summary: 'Все вложения диалога',
    description:
      'Список всех медиа-вложений (фото/видео) в диалоге. ' +
      'Опциональный фильтр type=image|video. Пагинация page/limit. Только для участников.',
  })
  @ApiOkResponse({
    description: 'Вложения с контекстом сообщения (messageId, senderId, createdAt)',
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
