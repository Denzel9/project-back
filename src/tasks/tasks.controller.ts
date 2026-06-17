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
import { ListTaskActivitiesQueryDto } from './dto/list-task-activities-query.dto';
import { ListTaskCommentsQueryDto } from './dto/list-task-comments-query.dto';
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
      'Задачи, где пользователь owner или executor. Фильтры: `role`, `status`. ' +
      'Создание задачи — автоматически при ACCEPTED отклика.',
  })
  @ApiOkResponse({ description: 'Список задач с пагинацией' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListTasksQueryDto) {
    return this.tasksService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Задача по id', description: 'С комментариями' })
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
    description: 'owner — все поля. executor — только `status`. VIEWER → 403.',
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
  @ApiOperation({ summary: 'Добавить комментарий' })
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
