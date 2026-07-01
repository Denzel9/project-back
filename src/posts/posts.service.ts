import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Post, PostAuthorType, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../media/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  jsonToArray,
  jsonToRecord,
  mapBudgetToApi,
} from './post-json.util';
import { buildPostFieldFilters } from './post-list-filters.util';
import {
  buildPostSearchWhere,
  postListOrderBy,
} from './post-list-query.util';
import { postJsonFieldsFromDto } from './post-write-fields.util';
import {
  assertCanViewPost,
  visiblePostTypeForRole,
} from './post-visibility.util';

export const postWithMediaInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
  owner: {
    select: {
      id: true,
      avatar: true,
      creatorProfile: {
        select: {
          name: true,
          lastName: true,
        },
      },
      companyProfile: {
        select: {
          companyName: true,
        },
      },
    },
  },
} satisfies Prisma.PostInclude;

export type PostWithMedia = Post & {
  media: {
    id: string;
    url: string;
    key: string;
    size: string;
    mimeType: string;
    sortOrder: number;
  }[];
  owner: {
    id: string;
    avatar: string;
    creatorProfile: {
      name: string;
      lastName: string;
    };
    companyProfile: {
      companyName: string;
    };
  };
};

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async create(user: AuthUser, dto: CreatePostDto): Promise<PostResponseDto> {
    const postType = this.roleToPostAuthorType(user.role);

    const post = await this.prisma.post.create({
      data: {
        title: dto.title,
        ownerId: user.userId,
        type: postType,
        permissions: dto.permissions ?? [],
        chips: dto.chips ?? [],
        description: dto.description ?? '',
        urgent: dto.urgent ?? false,
        keyWords: dto.keyWords ?? [],
        categories: dto.categories ?? [],
        isPrivate: dto.isPrivate ?? false,
        platforms: dto.platforms ?? [],
        placementFormats: dto.placementFormats ?? [],
        niche: dto.niche ?? [],
        tags: dto.tags ?? [],
        ...postJsonFieldsFromDto(dto),
      },
      include: postWithMediaInclude,
    });

    return this.toResponse(post);
  }

  async findById(user: AuthUser, id: string): Promise<PostResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postWithMediaInclude,
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    assertCanViewPost(user.role, user.userId, post);

    return this.toResponse(post);
  }

  async list(user: AuthUser, query: ListPostsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const viewingOwnPosts = query.ownerId === user.userId;
    const visibleType = visiblePostTypeForRole(user.role);

    if (
      !viewingOwnPosts &&
      query.type !== undefined &&
      query.type !== visibleType
    ) {
      throw new BadRequestException(
        'Фильтр type не соответствует постам, доступным для вашей роли'
      );
    }

    const where: Prisma.PostWhereInput = {
      ...(query.ownerId !== undefined
        ? { ownerId: query.ownerId }
        : { ownerId: { not: user.userId } }),
      ...(!viewingOwnPosts && { type: visibleType }),
      ...(viewingOwnPosts &&
        query.type !== undefined && { type: query.type }),
      ...(query.isArchived !== undefined
        ? { isArchived: query.isArchived }
        : !viewingOwnPosts
          ? { isArchived: false }
          : {}),
      ...(!viewingOwnPosts && { isPrivate: false }),
      ...(viewingOwnPosts &&
        query.isPrivate !== undefined && { isPrivate: query.isPrivate }),
      ...(query.q !== undefined && buildPostSearchWhere(query.q)),
      ...buildPostFieldFilters(query),
    };

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: postWithMediaInclude,
        orderBy: postListOrderBy,
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map(post => this.toResponse(post)),
      total,
      page,
      limit,
    };
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdatePostDto
  ): Promise<PostResponseDto> {
    await this.assertOwner(user.userId, id);

    const post = await this.prisma.post.update({
      where: { id },
      data: this.buildUpdateData(dto),
      include: postWithMediaInclude,
    });

    return this.toResponse(post);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.assertOwner(user.userId, id);

    await this.prisma.post.delete({
      where: { id },
    });
  }

  async assertOwnerForMedia(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { ownerId: true },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    if (post.ownerId !== userId) {
      throw new ForbiddenException(
        'Недостаточно прав для загрузки в этот пост'
      );
    }

    return post;
  }

  async addMedia(
    postId: string,
    data: { url: string; key: string; size: string; mimeType: string }
  ) {
    const count = await this.prisma.postMedia.count({
      where: { postId },
    });

    return this.prisma.postMedia.create({
      data: {
        postId,
        url: data.url,
        key: data.key,
        size: data.size,
        mimeType: data.mimeType,
        sortOrder: count,
      },
    });
  }

  async removeMedia(
    userId: string,
    postId: string,
    mediaId: string
  ): Promise<void> {
    await this.assertOwner(userId, postId);

    const media = await this.prisma.postMedia.findFirst({
      where: { id: mediaId, postId },
    });

    if (!media) {
      throw new NotFoundException('Медиа не найдено');
    }

    try {
      await this.storageService.deleteObject(media.key);
    } catch {
      throw new InternalServerErrorException('Не удалось удалить файл');
    }

    await this.prisma.postMedia.delete({
      where: { id: mediaId },
    });
  }

  private async assertOwner(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { ownerId: true },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    if (post.ownerId !== userId) {
      throw new ForbiddenException('Недостаточно прав для изменения поста');
    }
  }

  private roleToPostAuthorType(role: Role): PostAuthorType {
    if (role === Role.CREATOR) {
      return PostAuthorType.CREATOR;
    }

    if (role === Role.COMPANY) {
      return PostAuthorType.COMPANY;
    }

    throw new BadRequestException('Недопустимая роль для создания поста');
  }

  private buildUpdateData(dto: UpdatePostDto): Prisma.PostUpdateInput {
    const data: Prisma.PostUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.permissions !== undefined) data.permissions = dto.permissions;
    if (dto.chips !== undefined) data.chips = dto.chips;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.urgent !== undefined) data.urgent = dto.urgent;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;
    if (dto.isPrivate !== undefined) data.isPrivate = dto.isPrivate;
    if (dto.keyWords !== undefined) data.keyWords = dto.keyWords;
    if (dto.categories !== undefined) data.categories = dto.categories;
    if (dto.platforms !== undefined) data.platforms = dto.platforms;
    if (dto.placementFormats !== undefined) {
      data.placementFormats = dto.placementFormats;
    }
    if (dto.niche !== undefined) data.niche = dto.niche;
    if (dto.tags !== undefined) data.tags = dto.tags;

    Object.assign(data, postJsonFieldsFromDto(dto) as Prisma.PostUpdateInput);

    return data;
  }

  toResponse(post: PostWithMedia): PostResponseDto {
    const budget = mapBudgetToApi(jsonToRecord(post.budget));
    const location = jsonToRecord(post.location);
    const bloggerRequirements = jsonToRecord(post.bloggerRequirements);
    const cooperationDetails = jsonToRecord(post.cooperationDetails);
    const brief = jsonToRecord(post.brief);
    const deliverables = jsonToArray(post.deliverables);

    return {
      id: post.id,
      title: post.title,
      type: post.type,
      chips: post.chips,
      urgent: post.urgent,
      owner: {
        id: post.owner.id,
        avatar: post.owner.avatar,
        creatorProfile: {
          name: post.owner.creatorProfile?.name,
          lastName: post.owner.creatorProfile?.lastName,
        },
        companyProfile: {
          companyName: post.owner.companyProfile?.companyName,
        },
      },
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      media: post.media.map(item => ({
        id: item.id,
        url: item.url,
        key: item.key,
        size: item.size,
        mimeType: item.mimeType,
      })),
      description: post.description,
      isPrivate: post.isPrivate,
      isArchived: post.isArchived,
      categories: post.categories,
      permissions: post.permissions,
      ...(post.keyWords.length > 0 && { keyWords: post.keyWords }),
      ...(post.platforms.length > 0 && { platforms: post.platforms }),
      ...(post.placementFormats.length > 0 && {
        placementFormats: post.placementFormats,
      }),
      ...(post.niche.length > 0 && { niche: post.niche }),
      ...(post.tags.length > 0 && { tags: post.tags }),
      ...(budget && { budget: budget as PostResponseDto['budget'] }),
      ...(post.deadline && { deadline: post.deadline.toISOString() }),
      ...(post.workFormat && { workFormat: post.workFormat }),
      ...(location && { location: location as PostResponseDto['location'] }),
      ...(bloggerRequirements && {
        bloggerRequirements:
          bloggerRequirements as PostResponseDto['bloggerRequirements'],
      }),
      ...(cooperationDetails && {
        cooperationDetails:
          cooperationDetails as PostResponseDto['cooperationDetails'],
      }),
      ...(brief && { brief: brief as PostResponseDto['brief'] }),
      ...(deliverables &&
        deliverables.length > 0 && {
          deliverables:
            deliverables as unknown as PostResponseDto['deliverables'],
        }),
    };
  }
}
