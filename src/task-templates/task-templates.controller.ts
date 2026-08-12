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
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { EmailConfirmedGuard } from '../auth/guards/email-confirmed.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipWriteGuard } from '../auth/guards/membership-write.guard';
import { TaskResponseDto } from '../tasks/dto/task-response.dto';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { InstantiateTaskTemplateDto } from './dto/instantiate-task-template.dto';
import { TaskTemplateResponseDto } from './dto/task-template-response.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { TaskTemplatesService } from './task-templates.service';

@ApiTags('task-templates')
@ApiCookieAuth('access-token')
@Controller('task-templates')
@UseGuards(JwtAuthGuard)
export class TaskTemplatesController {
  constructor(private readonly taskTemplatesService: TaskTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Список шаблонов задач текущего профиля' })
  @ApiOkResponse({ type: TaskTemplateResponseDto, isArray: true })
  list(@CurrentUser() user: AuthUser) {
    return this.taskTemplatesService.list(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Шаблон задачи по id' })
  @ApiOkResponse({ type: TaskTemplateResponseDto })
  getById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.taskTemplatesService.getById(user, id);
  }

  @Post()
  @UseGuards(EmailConfirmedGuard, MembershipWriteGuard)
  @ApiOperation({ summary: 'Создать шаблон задачи' })
  @ApiCreatedResponse({ type: TaskTemplateResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskTemplateDto
  ) {
    return this.taskTemplatesService.create(user, dto);
  }

  @Post('from-task/:taskId')
  @UseGuards(EmailConfirmedGuard, MembershipWriteGuard)
  @ApiOperation({ summary: 'Сохранить задачу как шаблон' })
  @ApiCreatedResponse({ type: TaskTemplateResponseDto })
  createFromTask(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string
  ) {
    return this.taskTemplatesService.createFromTask(user, taskId);
  }

  @Post(':id/instantiate')
  @UseGuards(EmailConfirmedGuard, MembershipWriteGuard)
  @ApiOperation({ summary: 'Создать задачу из шаблона' })
  @ApiCreatedResponse({ type: TaskResponseDto })
  instantiate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InstantiateTaskTemplateDto
  ) {
    return this.taskTemplatesService.instantiate(user, id, dto);
  }

  @Patch(':id')
  @UseGuards(EmailConfirmedGuard, MembershipWriteGuard)
  @ApiOperation({ summary: 'Обновить шаблон задачи' })
  @ApiOkResponse({ type: TaskTemplateResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskTemplateDto
  ) {
    return this.taskTemplatesService.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(EmailConfirmedGuard, MembershipWriteGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить шаблон задачи' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.taskTemplatesService.remove(user, id);
  }
}
