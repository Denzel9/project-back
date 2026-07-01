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
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipWriteGuard } from '../auth/guards/membership-write.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ApplicationsService } from '../applications/applications.service';
import { ListApplicationsQueryDto } from '../applications/dto/list-applications-query.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@ApiCookieAuth('access-token')
@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly applicationsService: ApplicationsService
  ) {}

  @Post()
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Создать пост',
    description:
      'Создаёт пост от имени активного профиля. `ownerId` и `type` выставляются из JWT. ' +
      'Для прямого назначения исполнителя без публикации в ленте: `isPrivate: true`. ' +
      'Медиа загружаются отдельно: `POST /media/upload?postId={id}`.',
  })
  @ApiCreatedResponse({ type: PostResponseDto, description: 'Созданный пост' })
  @ApiForbiddenResponse({ description: 'Недостаточно прав (роль VIEWER)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Список постов',
    description:
      'Без `ownerId` — посты других пользователей, доступные для вашей роли ' +
      '(креаторы — только COMPANY, компании — только CREATOR); приватные посты скрыты. ' +
      'С `ownerId` = свой id — все свои посты (включая приватные). ' +
      'Поиск: `q` — по title или companyName; `title` — только по названию поста. ' +
      'Базовые фильтры: `type` (свои), `isArchived`, `isPrivate` (свои). ' +
      'Доп. фильтры: `urgent`, `chips`, `categories`, `platforms`, `placementFormats`, `niche`, `tags`, `workFormat`, ' +
      '`createdDate`, `deadlineDate`, `budgetType`, `budgetCurrency`, `paymentTerms`, `locationCity`, `locationCountry`, `shootingRequired`, ' +
      '`minFollowers`, `maxFollowers`, `minEngagementRate`, `verifiedAccount`, `experienceWithAds`, `contentStyle`, ' +
      '`exclusivity`, `exclusivityDays`, `usageRights`, `usageDurationDays`, `requiresMarking`, `requiresContract`, `ndaRequired`, ' +
      '`briefHashtag`, `briefMention`, `deliverablePlatform`, `deliverableFormat`. ' +
      'Массивы — через запятую (hasSome). Пагинация: `page`, `limit`.',
  })
  @ApiOkResponse({ description: 'Список постов с пагинацией' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListPostsQueryDto) {
    return this.postsService.list(user, query);
  }

  @Get(':id/applications')
  @ApiOperation({
    summary: 'Отклики на пост',
    description:
      'Владелец поста — все отклики с данными соискателя (applicant). ' +
      'Соискатель — только свой отклик. Фильтр по status, пагинация page/limit.',
  })
  @ApiOkResponse({ description: 'Список откликов на пост' })
  @ApiNotFoundResponse({ description: 'Пост не найден' })
  @ApiForbiddenResponse({ description: 'Нет доступа к откликам на этот пост' })
  listApplications(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListApplicationsQueryDto
  ) {
    return this.applicationsService.listByPost(user, id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить пост по id',
    description:
      'Возвращает пост с `media[]`. Приватный пост — только владелец (403 для остальных). ' +
      'Публичный: креаторы видят только посты компаний, компании — только посты креаторов. ' +
      'Владелец всегда видит свой пост.',
  })
  @ApiOkResponse({ type: PostResponseDto, description: 'Пост' })
  @ApiNotFoundResponse({ description: 'Пост не найден' })
  @ApiForbiddenResponse({ description: 'Пост недоступен для вашей роли' })
  findById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.postsService.findById(user, id);
  }

  @Patch(':id')
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Обновить пост',
    description:
      'Только владелец поста (`ownerId`). `ownerId` и `type` изменить нельзя. ' +
      '`isArchived: true` — архивировать пост.',
  })
  @ApiOkResponse({ type: PostResponseDto, description: 'Обновлённый пост' })
  @ApiNotFoundResponse({ description: 'Пост не найден' })
  @ApiForbiddenResponse({
    description: 'Недостаточно прав (не владелец или VIEWER)',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto
  ) {
    return this.postsService.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(MembershipWriteGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить пост',
    description:
      'Удаляет пост и связанные записи `PostMedia`. Файлы в S3 не удаляются.',
  })
  @ApiNoContentResponse({ description: 'Пост удалён' })
  @ApiNotFoundResponse({ description: 'Пост не найден' })
  @ApiForbiddenResponse({
    description: 'Недостаточно прав (не владелец или VIEWER)',
  })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.postsService.remove(user, id);
  }
}
