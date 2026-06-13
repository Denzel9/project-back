import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  postWithMediaInclude,
  PostsService,
  PostWithMedia,
} from '../posts/posts.service';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { CreateFavoriteGroupDto } from './dto/create-favorite-group.dto';
import { FavoriteGroupResponseDto } from './dto/favorite-group-response.dto';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { ListFavoritesQueryDto } from './dto/list-favorites-query.dto';
import { MoveFavoriteDto } from './dto/move-favorite.dto';
import { UpdateFavoriteGroupDto } from './dto/update-favorite-group.dto';

const favoriteInclude = {
  post: { include: postWithMediaInclude },
  group: true,
} satisfies Prisma.FavoritePostInclude;

type FavoriteWithRelations = Prisma.FavoritePostGetPayload<{
  include: typeof favoriteInclude;
}>;

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService
  ) {}

  async listGroups(userId: string): Promise<FavoriteGroupResponseDto[]> {
    const groups = await this.prisma.favoriteGroup.findMany({
      where: { userId },
      include: { _count: { select: { favorites: true } } },
      orderBy: { name: 'asc' },
    });

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      count: group._count.favorites,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    }));
  }

  async createGroup(
    user: AuthUser,
    dto: CreateFavoriteGroupDto
  ): Promise<FavoriteGroupResponseDto> {
    try {
      const group = await this.prisma.favoriteGroup.create({
        data: {
          userId: user.userId,
          name: dto.name,
        },
      });

      return {
        id: group.id,
        name: group.name,
        count: 0,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Группа с таким названием уже существует');
      }

      throw error;
    }
  }

  async updateGroup(
    user: AuthUser,
    id: string,
    dto: UpdateFavoriteGroupDto
  ): Promise<FavoriteGroupResponseDto> {
    await this.assertGroupOwner(user.userId, id);

    try {
      const group = await this.prisma.favoriteGroup.update({
        where: { id },
        data: { name: dto.name },
        include: { _count: { select: { favorites: true } } },
      });

      return {
        id: group.id,
        name: group.name,
        count: group._count.favorites,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Группа с таким названием уже существует');
      }

      throw error;
    }
  }

  async deleteGroup(user: AuthUser, id: string): Promise<void> {
    await this.assertGroupOwner(user.userId, id);

    await this.prisma.favoriteGroup.delete({
      where: { id },
    });
  }

  async addFavorite(
    user: AuthUser,
    dto: AddFavoriteDto
  ): Promise<FavoriteResponseDto> {
    await this.assertPostExists(dto.postId);

    if (dto.groupId !== undefined) {
      await this.assertGroupOwner(user.userId, dto.groupId);
    }

    const favorite = await this.prisma.favoritePost.upsert({
      where: {
        userId_postId: {
          userId: user.userId,
          postId: dto.postId,
        },
      },
      create: {
        userId: user.userId,
        postId: dto.postId,
        groupId: dto.groupId ?? null,
      },
      update: {
        groupId: dto.groupId ?? null,
      },
      include: favoriteInclude,
    });

    return this.mapFavorite(favorite);
  }

  async removeFavorite(user: AuthUser, postId: string): Promise<void> {
    const favorite = await this.prisma.favoritePost.findUnique({
      where: {
        userId_postId: {
          userId: user.userId,
          postId,
        },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Пост не найден в избранном');
    }

    await this.prisma.favoritePost.delete({
      where: { id: favorite.id },
    });
  }

  async moveFavorite(
    user: AuthUser,
    postId: string,
    dto: MoveFavoriteDto
  ): Promise<FavoriteResponseDto> {
    const favorite = await this.prisma.favoritePost.findUnique({
      where: {
        userId_postId: {
          userId: user.userId,
          postId,
        },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Пост не найден в избранном');
    }

    if (dto.groupId) {
      await this.assertGroupOwner(user.userId, dto.groupId);
    }

    const updated = await this.prisma.favoritePost.update({
      where: { id: favorite.id },
      data: { groupId: dto.groupId ?? null },
      include: favoriteInclude,
    });

    return this.mapFavorite(updated);
  }

  async listFavorites(user: AuthUser, query: ListFavoritesQueryDto) {
    if (query.groupId && query.ungrouped) {
      throw new BadRequestException(
        'Нельзя одновременно использовать groupId и ungrouped'
      );
    }

    if (query.groupId) {
      await this.assertGroupOwner(user.userId, query.groupId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FavoritePostWhereInput = {
      userId: user.userId,
      ...(query.groupId !== undefined && { groupId: query.groupId }),
      ...(query.ungrouped === true && { groupId: null }),
    };

    const [items, total] = await Promise.all([
      this.prisma.favoritePost.findMany({
        where,
        include: favoriteInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.favoritePost.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapFavorite(item)),
      total,
      page,
      limit,
    };
  }

  private async assertPostExists(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }
  }

  private async assertGroupOwner(userId: string, groupId: string) {
    const group = await this.prisma.favoriteGroup.findUnique({
      where: { id: groupId },
      select: { userId: true },
    });

    if (!group || group.userId !== userId) {
      throw new NotFoundException('Группа не найдена');
    }
  }

  private mapFavorite(favorite: FavoriteWithRelations): FavoriteResponseDto {
    return {
      postId: favorite.postId,
      groupId: favorite.groupId,
      groupName: favorite.group?.name ?? null,
      savedAt: favorite.createdAt.toISOString(),
      post: this.postsService.toResponse(favorite.post as PostWithMedia),
    };
  }
}
