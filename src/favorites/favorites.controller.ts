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
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { CreateFavoriteGroupDto } from './dto/create-favorite-group.dto';
import { FavoriteGroupResponseDto } from './dto/favorite-group-response.dto';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { ListFavoritesQueryDto } from './dto/list-favorites-query.dto';
import { MoveFavoriteDto } from './dto/move-favorite.dto';
import { UpdateFavoriteGroupDto } from './dto/update-favorite-group.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiCookieAuth('access-token')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get('groups')
  @ApiOperation({
    summary: 'Список групп избранного',
    description: 'Группы активного профиля с количеством постов в каждой.',
  })
  @ApiOkResponse({
    type: FavoriteGroupResponseDto,
    isArray: true,
    description: 'Группы избранного',
  })
  listGroups(@CurrentUser() user: AuthUser) {
    return this.favoritesService.listGroups(user.userId);
  }

  @Post('groups')
  @ApiOperation({
    summary: 'Создать группу избранного',
    description: 'Например: «спорт». Имя уникально в рамках профиля.',
  })
  @ApiCreatedResponse({
    type: FavoriteGroupResponseDto,
    description: 'Созданная группа',
  })
  @ApiConflictResponse({ description: 'Группа с таким названием уже существует' })
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFavoriteGroupDto
  ) {
    return this.favoritesService.createGroup(user, dto);
  }

  @Patch('groups/:id')
  @ApiOperation({ summary: 'Переименовать группу' })
  @ApiOkResponse({ type: FavoriteGroupResponseDto })
  @ApiNotFoundResponse({ description: 'Группа не найдена' })
  @ApiConflictResponse({ description: 'Группа с таким названием уже существует' })
  updateGroup(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFavoriteGroupDto
  ) {
    return this.favoritesService.updateGroup(user, id, dto);
  }

  @Delete('groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить группу',
    description: 'Посты из группы остаются в избранном без группы.',
  })
  @ApiNoContentResponse({ description: 'Группа удалена' })
  @ApiNotFoundResponse({ description: 'Группа не найдена' })
  deleteGroup(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.favoritesService.deleteGroup(user, id);
  }

  @Get()
  @ApiOperation({
    summary: 'Список избранных постов',
    description:
      'Все избранные, или фильтр `groupId`, или `ungrouped=true`. ' +
      'Каждый элемент содержит полный пост с `media[]`.',
  })
  @ApiOkResponse({ description: 'Избранное с пагинацией' })
  listFavorites(
    @CurrentUser() user: AuthUser,
    @Query() query: ListFavoritesQueryDto
  ) {
    return this.favoritesService.listFavorites(user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Добавить пост в избранное',
    description:
      'Upsert: повторный вызов обновляет группу. `groupId` опционален.',
  })
  @ApiCreatedResponse({ type: FavoriteResponseDto })
  @ApiNotFoundResponse({ description: 'Пост или группа не найдены' })
  addFavorite(@CurrentUser() user: AuthUser, @Body() dto: AddFavoriteDto) {
    return this.favoritesService.addFavorite(user, dto);
  }

  @Patch(':postId')
  @ApiOperation({
    summary: 'Переместить избранный пост в группу',
    description: '`groupId: null` — убрать из группы, оставить в избранном.',
  })
  @ApiOkResponse({ type: FavoriteResponseDto })
  @ApiNotFoundResponse({ description: 'Пост не найден в избранном или группа не найдена' })
  moveFavorite(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: MoveFavoriteDto
  ) {
    return this.favoritesService.moveFavorite(user, postId, dto);
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Убрать пост из избранного' })
  @ApiNoContentResponse({ description: 'Пост убран из избранного' })
  @ApiNotFoundResponse({ description: 'Пост не найден в избранном' })
  removeFavorite(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string
  ) {
    return this.favoritesService.removeFavorite(user, postId);
  }
}
