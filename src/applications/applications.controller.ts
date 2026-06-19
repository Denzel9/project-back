import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { ApplicationsService } from './applications.service';

@ApiTags('applications')
@ApiCookieAuth('access-token')
@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Откликнуться на пост',
    description:
      'Один отклик на пост. Нельзя откликнуться на свой или архивный пост. ' +
      'ACCEPTED создаёт задачу. Создаёт сообщение «Новый отклик» в диалоге с владельцем поста. ' +
      'Владельцу поста отправляется email на Account OWNER.',
  })
  @ApiCreatedResponse({ type: ApplicationResponseDto })
  @ApiNotFoundResponse({ description: 'Пост не найден' })
  @ApiBadRequestResponse({ description: 'Недопустимый отклик' })
  @ApiConflictResponse({ description: 'Уже откликались на этот пост' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(user, dto);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'Мои отклики',
    description:
      'Отклики активного профиля с краткой информацией о посте. ' +
      'Фильтры: `type` (CREATOR / COMPANY), `status`, `updatedDate` (YYYY-MM-DD). ' +
      'Поиск: `q` — по названию поста или названию компании.',
  })
  @ApiOkResponse({ description: 'Список откликов с пагинацией' })
  listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListApplicationsQueryDto
  ) {
    return this.applicationsService.listMine(user, query);
  }

  @Get('incoming')
  @ApiOperation({
    summary: 'Входящие отклики на мои посты',
    description:
      'Все отклики на посты активного профиля (владелец). ' +
      'Фильтры: `postId`, `status`, `updatedDate` (YYYY-MM-DD, UTC), `type` (CREATOR / COMPANY). ' +
      'Поиск: `q` — по названию поста. Содержит данные поста и соискателя (applicant).',
  })
  @ApiOkResponse({ description: 'Список входящих откликов с пагинацией' })
  listIncoming(
    @CurrentUser() user: AuthUser,
    @Query() query: ListApplicationsQueryDto
  ) {
    return this.applicationsService.listIncoming(user, query);
  }

  @Patch(':id/withdraw')
  @ApiOperation({
    summary: 'Отозвать отклик',
    description: 'Только соискатель. Статусы NEW и VIEWED → WITHDRAWN.',
  })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiNotFoundResponse({ description: 'Отклик не найден' })
  @ApiForbiddenResponse({ description: 'Не ваш отклик' })
  @ApiBadRequestResponse({ description: 'Нельзя отозвать в текущем статусе' })
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.applicationsService.withdraw(user, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Изменить статус отклика',
    description:
      'Только владелец поста. NEW → VIEWED/ACCEPTED/REJECTED; VIEWED → ACCEPTED/REJECTED.',
  })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiNotFoundResponse({ description: 'Отклик не найден' })
  @ApiForbiddenResponse({ description: 'Не владелец поста' })
  @ApiBadRequestResponse({ description: 'Недопустимый переход статуса' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationStatusDto
  ) {
    return this.applicationsService.updateStatus(user, id, dto);
  }
}
