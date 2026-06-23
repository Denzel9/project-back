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
import { AuthUser } from '../auth/auth.types';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTaskActivitiesQueryDto } from './dto/list-task-activities-query.dto';
import { ListTaskCommentsQueryDto } from './dto/list-task-comments-query.dto';
import { ListTaskCommentAttachmentsQueryDto } from './dto/list-task-comment-attachments-query.dto';
import { ListTaskCommentAttachmentsResponseDto } from './dto/list-task-comment-attachments-response.dto';
import { ListTaskAttachmentsQueryDto } from './dto/list-task-attachments-query.dto';
import { ListTaskAttachmentsResponseDto } from './dto/list-task-attachments-response.dto';
import { SearchTaskCommentsQueryDto } from './dto/search-task-comments-query.dto';
import { SearchTaskCommentsResponseDto } from './dto/search-task-comments-response.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import {
  TaskCommentResponseDto,
  TaskResponseDto,
} from './dto/task-response.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
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
      'Задачи, где пользователь owner или executor. Фильтры: `postId`, `role`, `status`, `updatedDate` (YYYY-MM-DD, UTC), `q` (название поста или компании). ' +
      'Задачи без ответа исполнителя (`isExecutorApprove: null`) — в `GET /tasks/pending-approval`. ' +
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

  @Post()
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Создать задачу вручную',
    description:
      'Только владелец поста. Создаёт задачу без отклика (`applicationId` = null). ' +
      '`executorId` опционален — можно назначить позже через PATCH.',
  })
  @ApiCreatedResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Пост или исполнитель не найдены' })
  @ApiForbiddenResponse({ description: 'Не владелец поста или VIEWER' })
  @ApiBadRequestResponse({ description: 'Недопустимые данные' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Задача по id',
    description:
      'С комментариями. `description` — Markdown. Исполнитель не видит `post`.',
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
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Обновить задачу',
    description:
      'owner — все поля (включая `executorId`, `isExecutorApprove`); executor — `status` и `isExecutorApprove`. `description` — Markdown. VIEWER → 403.',
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Удалить задачу',
    description:
      'Только владелец поста. Удаляет задачу, комментарии, активности и медиа в БД; файлы задачи — в S3.',
  })
  @ApiNoContentResponse({ description: 'Задача удалена' })
  @ApiNotFoundResponse({ description: 'Задача не найдена' })
  @ApiForbiddenResponse({ description: 'Не владелец поста или VIEWER' })
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
      'Фильтр `type`: STATUS_CHANGED, FIELD_UPDATED, MEDIA_ADDED, MEDIA_REMOVED. ' +
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
  @ApiOperation({ summary: 'Комментарии задачи' })
  @ApiOkResponse({ description: 'Список комментариев с пагинацией' })
  listComments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListTaskCommentsQueryDto
  ) {
    return this.tasksService.listComments(user, id, query);
  }

  @Post(':id/comments')
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Добавить комментарий',
    description:
      'Текст и/или media[] после `POST /media/upload?taskId={id}&forComment=true`. ' +
      'Нужен content или media.',
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
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Редактировать комментарий',
    description: 'owner — любой; executor — только свой',
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

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Удалить комментарий',
    description: 'owner — любой; executor — только свой',
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
