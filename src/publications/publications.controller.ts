import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
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
import { EmailConfirmedGuard } from '../auth/guards/email-confirmed.guard';
import { AuthUser } from '../auth/auth.types';
import { ListPublicationsQueryDto } from './dto/list-publications-query.dto';
import { PublicationResponseDto } from './dto/publication-response.dto';
import { UpdatePublicationDto } from './dto/update-publication.dto';
import { PublicationsService } from './publications.service';

@ApiTags('publications')
@ApiCookieAuth('access-token')
@Controller('publications')
@UseGuards(JwtAuthGuard)
export class PublicationsController {
  constructor(private readonly publicationsService: PublicationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Список публикаций',
    description:
      'Публикации по задачам, где пользователь owner или executor. ' +
      'Создаются автоматически при `COMPLETED` задачи. ' +
      'Фильтры: `role`, `postId`, `taskId`, `ownerId`, `executorId`, `q` (title), `executorQ` (имя исполнителя).',
  })
  @ApiOkResponse({ description: 'Список публикаций с пагинацией' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPublicationsQueryDto
  ) {
    return this.publicationsService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Публикация по id' })
  @ApiOkResponse({ type: PublicationResponseDto })
  @ApiNotFoundResponse({ description: 'Публикация не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  findById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.publicationsService.findById(user, id);
  }

  @Patch(':id')
  @UseGuards(EmailConfirmedGuard)
  @ApiOperation({
    summary: 'Обновить публикацию',
    description:
      'Участники задачи могут редактировать `title`, `description`, `externalUrl`, `platform`.',
  })
  @ApiOkResponse({ type: PublicationResponseDto })
  @ApiNotFoundResponse({ description: 'Публикация не найдена' })
  @ApiForbiddenResponse({ description: 'Нет доступа' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePublicationDto
  ) {
    return this.publicationsService.update(user, id, dto);
  }
}
