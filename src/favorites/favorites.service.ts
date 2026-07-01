import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
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
import {
  FavoriteResponseDto,
  FavoriteUserItemResponseDto,
} from './dto/favorite-response.dto';
import { FavoriteListType } from './dto/favorite-list-type.enum';
import { ListFavoritesQueryDto } from './dto/list-favorites-query.dto';
import { MoveFavoriteDto } from './dto/move-favorite.dto';
import { UpdateFavoriteGroupDto } from './dto/update-favorite-group.dto';
import { mapFavoriteUserProfile } from './favorite-user-profile.util';
import {
  assertCanViewPost,
  visiblePostTypeForRole,
} from '../posts/post-visibility.util';

const favoriteInclude = {
  post: { include: postWithMediaInclude },
  group: true,
} satisfies Prisma.FavoritePostInclude;

const favoriteUserInclude = {
  favoriteUser: {
    include: {
      creatorProfile: true,
      companyProfile: true,
    },
  },
} satisfies Prisma.FavoriteUserInclude;

type FavoriteWithRelations = Prisma.FavoritePostGetPayload<{
  include: typeof favoriteInclude;
}>;

type FavoriteUserWithRelations = Prisma.FavoriteUserGetPayload<{
  include: typeof favoriteUserInclude;
}>;

const favoriteUserProfileInclude = {
  creatorProfile: true,
  companyProfile: true,
} as const;

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

    return groups.map(group => ({
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
  ): Promise<FavoriteResponseDto | FavoriteUserItemResponseDto> {
    const hasPostId = dto.postId !== undefined;
    const hasUserId = dto.userId !== undefined;

    if (hasPostId === hasUserId) {
      throw new BadRequestException(
        'Укажите ровно одно поле: postId или userId'
      );
    }

    if (hasUserId) {
      if (dto.groupId !== undefined) {
        throw new BadRequestException(
          'Группы избранного доступны только для постов'
        );
      }

      return this.addFavoriteUser(user, dto.userId!);
    }

    if (dto.groupId !== undefined) {
      await this.assertGroupOwner(user.userId, dto.groupId);
    }

    await this.assertPostVisible(user, dto.postId!);

    const favorite = await this.prisma.favoritePost.upsert({
      where: {
        userId_postId: {
          userId: user.userId,
          postId: dto.postId!,
        },
      },
      create: {
        userId: user.userId,
        postId: dto.postId!,
        groupId: dto.groupId ?? null,
      },
      update: {
        groupId: dto.groupId ?? null,
      },
      include: favoriteInclude,
    });

    return this.mapPostFavorite(favorite);
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

  async removeFavoriteUser(
    user: AuthUser,
    favoriteUserId: string
  ): Promise<void> {
    const favorite = await this.prisma.favoriteUser.findUnique({
      where: {
        userId_favoriteUserId: {
          userId: user.userId,
          favoriteUserId,
        },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Пользователь не найден в избранном');
    }

    await this.prisma.favoriteUser.delete({
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

    return this.mapPostFavorite(updated);
  }

  async listFavorites(user: AuthUser, query: ListFavoritesQueryDto) {
    const listType = query.type ?? FavoriteListType.POST;

    if (listType === FavoriteListType.POST) {
      return this.listPostFavorites(user, query);
    }

    return this.listUserFavorites(user, query, listType);
  }

  private async listPostFavorites(
    user: AuthUser,
    query: ListFavoritesQueryDto
  ) {
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
      post: { type: visiblePostTypeForRole(user.role) },
      ...(query.groupId !== undefined && { groupId: query.groupId }),
      ...(query.ungrouped === true && { groupId: null }),
      ...(query.q !== undefined && {
        post: {
          type: visiblePostTypeForRole(user.role),
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            {
              owner: {
                companyProfile: {
                  companyName: { contains: query.q, mode: 'insensitive' },
                },
              },
            },
          ],
        },
      }),
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
      items: items.map(item => this.mapPostFavorite(item)),
      total,
      page,
      limit,
    };
  }

  private async listUserFavorites(
    user: AuthUser,
    query: ListFavoritesQueryDto,
    listType: FavoriteListType.CREATOR | FavoriteListType.COMPANY
  ) {
    if (query.groupId !== undefined || query.ungrouped !== undefined) {
      throw new BadRequestException(
        'Фильтры groupId и ungrouped доступны только для type=POST'
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const role =
      listType === FavoriteListType.CREATOR ? Role.CREATOR : Role.COMPANY;

    const where: Prisma.FavoriteUserWhereInput = {
      userId: user.userId,
      favoriteUser: {
        role,
        ...(query.q !== undefined &&
          (listType === FavoriteListType.CREATOR
            ? {
              OR: [
                {
                  creatorProfile: {
                    name: { contains: query.q, mode: 'insensitive' },
                  },
                },
                {
                  creatorProfile: {
                    lastName: { contains: query.q, mode: 'insensitive' },
                  },
                },
              ],
            }
            : {
              companyProfile: {
                companyName: { contains: query.q, mode: 'insensitive' },
              },
            })),
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.favoriteUser.findMany({
        where,
        include: favoriteUserInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.favoriteUser.count({ where }),
    ]);

    return {
      items: items.map(item => this.mapUserFavorite(item)),
      total,
      page,
      limit,
    };
  }

  private async addFavoriteUser(
    user: AuthUser,
    favoriteUserId: string
  ): Promise<FavoriteUserItemResponseDto> {
    if (favoriteUserId === user.userId) {
      throw new BadRequestException('Нельзя добавить себя в избранное');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: favoriteUserId },
      include: favoriteUserProfileInclude,
    });

    if (!targetUser) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (targetUser.role !== Role.CREATOR && targetUser.role !== Role.COMPANY) {
      throw new BadRequestException(
        'В избранное можно добавить только креатора или компанию'
      );
    }

    const favorite = await this.prisma.favoriteUser.upsert({
      where: {
        userId_favoriteUserId: {
          userId: user.userId,
          favoriteUserId,
        },
      },
      create: {
        userId: user.userId,
        favoriteUserId,
      },
      update: {},
      include: favoriteUserInclude,
    });

    return this.mapUserFavorite(favorite);
  }

  private async assertPostVisible(user: AuthUser, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, ownerId: true, type: true, isPrivate: true },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    assertCanViewPost(user.role, user.userId, post);
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

  private mapPostFavorite(
    favorite: FavoriteWithRelations
  ): FavoriteResponseDto {
    return {
      type: FavoriteListType.POST,
      postId: favorite.postId,
      groupId: favorite.groupId,
      groupName: favorite.group?.name ?? null,
      savedAt: favorite.createdAt.toISOString(),
      post: this.postsService.toResponse(favorite.post as PostWithMedia),
    };
  }

  private mapUserFavorite(
    favorite: FavoriteUserWithRelations
  ): FavoriteUserItemResponseDto {
    const listType =
      favorite.favoriteUser.role === Role.CREATOR
        ? FavoriteListType.CREATOR
        : FavoriteListType.COMPANY;

    return {
      type: listType,
      userId: favorite.favoriteUserId,
      savedAt: favorite.createdAt.toISOString(),
      user: mapFavoriteUserProfile(favorite.favoriteUser),
    };
  }
}
