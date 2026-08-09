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
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
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
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTaskActivitiesQueryDto } from './dto/list-task-activities-query.dto';
import { ListAllTaskActivitiesQueryDto } from './dto/list-all-task-activities-query.dto';
import { ListAllTaskCommentsQueryDto } from './dto/list-all-task-comments-query.dto';
import { ListTasksWithCommentsQueryDto } from './dto/list-tasks-with-comments-query.dto';
import { ListTaskCommentsQueryDto } from './dto/list-task-comments-query.dto';
import { ListTaskCommentAttachmentsQueryDto } from './dto/list-task-comment-attachments-query.dto';
import { ListTaskCommentAttachmentsResponseDto } from './dto/list-task-comment-attachments-response.dto';
import { ListTaskAttachmentsQueryDto } from './dto/list-task-attachments-query.dto';
import { ListTaskAttachmentsResponseDto } from './dto/list-task-attachments-response.dto';
import { SearchTaskCommentsQueryDto } from './dto/search-task-comments-query.dto';
import { SearchTaskCommentsResponseDto } from './dto/search-task-comments-response.dto';
import { TaskCommentPinResponseDto } from './dto/task-comment-pin-response.dto';
import { UpdateTaskCommentPinDto } from './dto/update-task-comment-pin.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { ListTasksCalendarQueryDto } from './dto/list-tasks-calendar-query.dto';
import { ListTaskStatsQueryDto } from './dto/list-task-stats-query.dto';
import { TaskStatsResponseDto } from './dto/task-stats-response.dto';
import {
  TaskCommentResponseDto,
  TaskResponseDto,
} from './dto/task-response.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RequestTaskAnnulmentDto } from './dto/task-annulment.dto';
import { RequestTaskDeadlineExtensionDto } from './dto/task-deadline-extension.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiCookieAuth('access-token')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({
    summary: 'Список задач',
    description:
      'Задачи, где пользователь owner или executor. Фильтры: `postId`, `role`, `ownerId`, `executorId`, `status`, `statuses`, `active`, `excludeCompleted`, `isCompanyAction`, `isExecutorApprove` (`true`/`false`/`null`), `unassigned`, `overdue`, `urgent`, `createdDate`, `dateFrom`/`dateTo`, `q`. ' +
      'Создание — автоматически при ACCEPTED отклика или `POST /tasks` вручную (владелец поста). У исполнителя нет блока `post`.',
  })
  @ApiOkResponse({ description: 'Список задач с пагинацией' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListTasksQueryDto) {
    return this.tasksService.list(user, query);
  }

  @Get('pending-approval')
  @ApiOperation({
    summary: 'Задачи исполнителя без одобрения',
    description:
      'Только задачи, где текущий пользователь — исполнитель и `isExecutorApprove === null`. ' +
      'Те же фильтры, что у `GET /tasks`, кроме `role` (всегда executor).',
  })
  @ApiOkResponse({ description: 'Список задач с пагинацией' })
  listPendingApproval(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTasksQueryDto
  ) {
    return this.tasksService.listPendingApproval(user, query);
  }

  @Get('activities')
  @ApiOperation({
    summary: 'Лента активностей по всем задачам',
    description:
      'Активности по задачам, где пользователь owner или executor. ' +
      'Фильтры: `type`, `role` (owner|executor), `taskId`. Сортировка — от новых к старым.',
  })
  @ApiOkResponse({ description: 'Список активностей с пагинацией' })
  @ApiNotFoundResponse({
    description: 'Задача не найдена (при указанном taskId)',
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к задаче (при taskId)' })
  listAllActivities(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAllTaskActivitiesQueryDto
  ) {
    return this.tasksService.listAllActivities(user, query);
  }

  @Get('comments')
  @ApiOperation({
    summary: 'Лента комментариев по всем задачам',
    description:
      'Комментарии по задачам, где пользователь owner или executor. ' +
      'Фильтры: `role` (owner|executor), `taskId`, `q` (поиск по тексту). Сортировка — от новых к старым.',
  })
  @ApiOkResponse({ description: 'Список комментариев с пагинацией' })
  @ApiNotFoundResponse({
    description: 'Задача не найдена (при указанном taskId)',
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к задаче (при taskId)' })
  listAllComments(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAllTaskCommentsQueryDto
  ) {
    return this.tasksService.listAllComments(user, query);
  }

  @Get('with-comments')
  @ApiOperation({
    summary: 'Задачи с комментариями',
    description:
      'Только задачи, где есть хотя бы один комментарий. ' +
      'По каждой: title, превью последнего комментария, `commentsCount`, `unreadCount` ' +
      '(по lastReadAt текущего пользователя). ' +
      'Сортировка по времени последнего комментария. Фильтры: `role`, `postId`, `taskId`, `status`, `q`.',
  })
  @ApiOkResponse({ description: 'Список задач с превью комментариев' })
  listTasksWithComments(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTasksWithCommentsQueryDto
  ) {
    return this.tasksService.listTasksWithComments(user, query);
  }

  @Get('calendar')
  @ApiOperation({
    summary: 'Задачи для календаря',
    description:
      'Компактный список задач, где пользователь owner или executor. ' +
      'Поля: id, createdAt, updatedAt, urgent, finalDate, title, owner, executor. ' +
      'Фильтры: `dateFrom`/`dateTo` + `dateField` (`createdAt` | `updatedAt` | `finalDate`), ' +
      '`urgent`, `ownerId`, `executorId`, `role` (owner|executor). ' +
      'Сортировка по выбранному `dateField` (по возрастанию).',
  })
  @ApiOkResponse({ description: 'Список задач для календаря с пагинацией' })
  listCalendar(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTasksCalendarQueryDto
  ) {
    return this.tasksService.listCalendar(user, query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Счётчики задач для дашборда',
    description:
      'Счётчики по доступным задачам (owner или executor). Категории могут пересекаться. ' +
      '`awaitingAction` — очередь текущего пользователя (`isCompanyAction`). ' +
      '`awaitingConfirmation` — `isExecutorApprove: null` и есть `executorId`. ' +
      '`unassigned` — без исполнителя (`executorId: null`, `isExecutorApprove: null`, только owner). ' +
      '`overdue` — `finalDate` в прошлом. `urgent` — срочные активные. `underReview` — `CHECKING`. ' +
      '`cancelled` — аннулированные (`ANNULLED`). ' +
      'Фильтры: `role`, `postId`.',
  })
  @ApiOkResponse({ type: TaskStatsResponseDto })
  getStats(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTaskStatsQueryDto
  ) {
    return this.tasksService.getStats(user, query);
  }

  @Post()
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Создать задачу вручную',
    description:
      'Только владелец поста. Создаёт задачу без отклика (`applicationId` = null). ' +
      '`executorId` опционален — можно назначить позже через PATCH. ' +
      'JSON: `location`, `brief`, `deliverables`. ' +
      '`bloggerRequirements` / `cooperationDetails` — nested в API, в БД плоские колонки.',
  })
  @ApiCreatedResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Пост или исполнитель не найдены' })
  @ApiForbiddenResponse({ description: 'Недостаточно прав' })
  @ApiBadRequestResponse({ description: 'Недопустимые данные' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Задача по id',
    description:
      '`description` — Markdown. Исполнитель не видит `post`. Комментарии — `GET /tasks/:id/comments`.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  findById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.tasksService.findById(user, id);
  }

  @Patch(':id')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Обновить задачу',
    description:
      'owner — все поля (включая `executorId`, `isExecutorApprove`, JSON: `location`, `brief`, `deliverables`, nested `bloggerRequirements`/`cooperationDetails`); executor — `status`, `isExecutorApprove` и `isCompanyAction`. `description` — Markdown.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа или недопустимые поля' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto
  ) {
    return this.tasksService.update(user, id, dto);
  }

  @Post(':id/annulment')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Запросить аннулирование задачи',
    description:
      'Создаёт запись аннулирования со статусом PENDING. Статус задачи не меняется, пока вторая сторона не подтвердит. ' +
      'Доступно owner/executor при назначенном исполнителе.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  @ApiBadRequestResponse({ description: 'Недопустимое состояние задачи' })
  requestAnnulment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestTaskAnnulmentDto
  ) {
    return this.tasksService.requestAnnulment(user, id, dto);
  }

  @Post(':id/annulment/confirm')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Подтвердить аннулирование задачи',
    description:
      'Только вторая сторона. Ставит `status: ANNULLED` и статус запроса CONFIRMED.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа или вы инициатор запроса' })
  @ApiBadRequestResponse({ description: 'Нет активного запроса' })
  confirmAnnulment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.tasksService.confirmAnnulment(user, id);
  }

  @Post(':id/annulment/reject')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Отклонить аннулирование задачи',
    description:
      'Только вторая сторона. Ставит `annulment.status: REJECTED`, запись сохраняется в истории.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа или вы инициатор запроса' })
  @ApiBadRequestResponse({ description: 'Нет активного запроса' })
  rejectAnnulment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.tasksService.rejectAnnulment(user, id);
  }

  @Post(':id/deadline-extension')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Запросить перенос дедлайна',
    description:
      'Создаёт запись переноса со статусом PENDING. `finalDate` не меняется, пока вторая сторона не подтвердит. ' +
      'Доступно owner/executor при назначенном исполнителе.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  @ApiBadRequestResponse({ description: 'Недопустимое состояние задачи' })
  requestDeadlineExtension(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestTaskDeadlineExtensionDto
  ) {
    return this.tasksService.requestDeadlineExtension(user, id, dto);
  }

  @Post(':id/deadline-extension/confirm')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Подтвердить перенос дедлайна',
    description:
      'Только вторая сторона. Обновляет `finalDate` и ставит статус запроса CONFIRMED.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа или вы инициатор запроса' })
  @ApiBadRequestResponse({ description: 'Нет активного запроса' })
  confirmDeadlineExtension(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.tasksService.confirmDeadlineExtension(user, id);
  }

  @Post(':id/deadline-extension/reject')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Отклонить перенос дедлайна',
    description:
      'Только вторая сторона. Ставит статус REJECTED, запись сохраняется в истории. `finalDate` не меняется.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа или вы инициатор запроса' })
  @ApiBadRequestResponse({ description: 'Нет активного запроса' })
  rejectDeadlineExtension(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.tasksService.rejectDeadlineExtension(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Удалить задачу',
    description:
      'Только владелец поста. Удаляет задачу, комментарии, активности и медиа в БД; файлы задачи — в S3.',
  })
  @ApiNoContentResponse({ description: 'Задача удалена' })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Недостаточно прав' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.tasksService.remove(user, id);
  }

  @Get(':id/activities')
  @ApiOperation({
    summary: 'Активности задачи',
    description:
      'История изменений: статус, поля задачи, загрузка и удаление медиа. ' +
      'Фильтр `type`: STATUS_CHANGED, FIELD_UPDATED, MEDIA_ADDED, MEDIA_REMOVED, ' +
      'ANNULMENT_*, DEADLINE_EXTENSION_*. ' +
      'Сортировка — от новых к старым.',
  })
  @ApiOkResponse({ description: 'Список активностей с пагинацией' })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  listActivities(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListTaskActivitiesQueryDto
  ) {
    return this.tasksService.listActivities(user, id, query);
  }

  @Get(':id/attachments')
  @ApiOperation({
    summary: 'Вложения задачи',
    description:
      'Медиа задачи (TaskMedia). Фильтры: kind=main|report, type=image|video|document. Пагинация page/limit.',
  })
  @ApiOkResponse({
    description: 'Вложения задачи с kind и createdAt',
    type: ListTaskAttachmentsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  listAttachments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListTaskAttachmentsQueryDto
  ) {
    return this.tasksService.listAttachments(user, id, query);
  }

  @Get(':id/comments/search')
  @ApiOperation({
    summary: 'Поиск комментариев задачи',
    description:
      'Поиск по тексту content (без учёта регистра). Комментарии с media[]. Пагинация page/limit.',
  })
  @ApiOkResponse({
    description: 'Найденные комментарии с пагинацией',
    type: SearchTaskCommentsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  searchComments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SearchTaskCommentsQueryDto
  ) {
    return this.tasksService.searchComments(user, id, query);
  }

  @Get(':id/comments/pins')
  @ApiOperation({
    summary: 'Закреплённые комментарии задачи',
  })
  @ApiOkResponse({ type: TaskCommentPinResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  listCommentPins(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.tasksService.listCommentPins(user, id);
  }

  @Get(':id/comments/attachments')
  @ApiOperation({
    summary: 'Вложения в комментариях задачи',
    description:
      'Все медиа из комментариев задачи. Фильтр type=image|video|document. Пагинация page/limit.',
  })
  @ApiOkResponse({
    description:
      'Вложения с контекстом комментария (commentId, authorId, createdAt)',
    type: ListTaskCommentAttachmentsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  listCommentAttachments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListTaskCommentAttachmentsQueryDto
  ) {
    return this.tasksService.listCommentAttachments(user, id, query);
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: 'Комментарии задачи',
    description:
      'В каждом комментарии: `editedAt`, `isRead`. ' +
      'По умолчанию `markRead=true` — задача отмечается прочитанной.',
  })
  @ApiOkResponse({ description: 'Список комментариев с пагинацией' })
  listComments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListTaskCommentsQueryDto
  ) {
    return this.tasksService.listComments(user, id, query);
  }

  @Post(':id/comments/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Отметить комментарии задачи прочитанными',
    description:
      'Обновляет lastReadAt до времени последнего комментария. ' +
      'Собеседник получит событие comments_read по WebSocket `/task-comments`.',
  })
  @ApiOkResponse({
    description: 'Комментарии отмечены прочитанными',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', format: 'uuid' },
        readAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Нет доступа к задаче' })
  async markCommentsRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const readAt = await this.tasksService.markTaskCommentsAsRead(
      id,
      user.userId
    );

    return {
      taskId: id,
      readAt: readAt.toISOString(),
    };
  }

  @Post(':id/comments')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Добавить комментарий',
    description:
      'Текст и/или media[] после `POST /media/upload?taskId={id}&forComment=true`. ' +
      'Нужен content или media. Участники получат событие `comment` по WebSocket.',
  })
  @ApiCreatedResponse({ type: TaskCommentResponseDto })
  createComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskCommentDto
  ) {
    return this.tasksService.createComment(user, id, dto);
  }

  @Patch(':id/comments/:commentId')
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Редактировать комментарий',
    description:
      'Меняет только текст. Пустой текст допустим, если есть media[]. ' +
      'owner — любой; executor — только свой. Событие `comment_edited` по WebSocket.',
  })
  @ApiOkResponse({ type: TaskCommentResponseDto })
  updateComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateTaskCommentDto
  ) {
    return this.tasksService.updateComment(user, id, commentId, dto);
  }

  @Patch(':id/comments/:commentId/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Закрепить / открепить комментарий',
  })
  @ApiNoContentResponse({ description: 'Статус закрепления обновлён' })
  @ApiNotFoundResponse({ description: 'Комментарий не найден' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  async pinComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateTaskCommentPinDto
  ) {
    await this.tasksService.pinComment(user, id, commentId, dto.isPinned);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(MembershipWriteGuard, EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Удалить комментарий',
    description:
      'owner — любой; executor — только свой. Событие `comment_deleted` по WebSocket.',
  })
  @ApiNoContentResponse({ description: 'Комментарий удалён' })
  deleteComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string
  ) {
    return this.tasksService.deleteComment(user, id, commentId);
  }
}
