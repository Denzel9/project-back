import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Post, PostAuthorType, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MIME_TO_EXTENSION } from '../media/media.constants';
import { StorageService } from '../media/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import {
  PostOptionDto,
  PostOptionsResponseDto,
} from './dto/post-options.dto';
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
  columnsToBloggerRequirements,
  columnsToCooperationDetails,
} from './blogger-coop-fields.util';
import {
  assertCanViewPost,
  visiblePostTypeForRole,
} from './post-visibility.util';
import { assertMarketplaceTrader } from '../auth/utils/marketplace-participant.util';
import {
  mapOwnerWithStats,
  userOwnerWithStatsSelect,
  type UserStatsCount,
} from '../users/user-stats.util';

export const postWithMediaInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
  owner: {
    select: userOwnerWithStatsSelect,
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
    _count: UserStatsCount;
  };
};

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async create(user: AuthUser, dto: CreatePostDto): Promise<PostResponseDto> {
    assertMarketplaceTrader(user.role);

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
        isPrivate: dto.isTemplate ? true : (dto.isPrivate ?? false),
        isTemplate: dto.isTemplate ?? false,
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
      visibleType !== null &&
      query.type !== undefined &&
      query.type !== visibleType
    ) {
      throw new BadRequestException(
        'Фильтр type не соответствует постам, доступным для вашей роли'
      );
    }

    if (query.isTemplate === true && !viewingOwnPosts) {
      throw new BadRequestException(
        'Шаблоны объявлений доступны только для своих постов'
      );
    }

    const where: Prisma.PostWhereInput = {
      ...(query.ownerId !== undefined
        ? { ownerId: query.ownerId }
        : { ownerId: { not: user.userId } }),
      ...(!viewingOwnPosts && visibleType !== null && { type: visibleType }),
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
      isTemplate: query.isTemplate === true,
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

  async listOptions(user: AuthUser): Promise<PostOptionsResponseDto> {
    const items = await this.prisma.post.findMany({
      where: {
        ownerId: user.userId,
        isArchived: false,
        isTemplate: false,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: postListOrderBy,
    });

    return {
      items: items.map(
        (post): PostOptionDto => ({
          id: post.id,
          title: post.title,
        })
      ),
    };
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdatePostDto
  ): Promise<PostResponseDto> {
    const existing = await this.assertOwner(user.userId, id);
    const data = this.buildUpdateData(dto);

    if (dto.isTemplate === false) {
      data.isTemplate = false;
      if (dto.isPrivate === undefined) {
        data.isPrivate = false;
      }
    } else if (existing.isTemplate || dto.isTemplate) {
      data.isPrivate = true;
      data.isTemplate = true;
    }

    const post = await this.prisma.post.update({
      where: { id },
      data,
      include: postWithMediaInclude,
    });

    return this.toResponse(post);
  }

  async publishFromTemplate(
    user: AuthUser,
    id: string
  ): Promise<PostResponseDto> {
    assertMarketplaceTrader(user.role);

    const template = await this.prisma.post.findUnique({
      where: { id },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!template) {
      throw new NotFoundException('Пост не найден');
    }

    if (template.ownerId !== user.userId) {
      throw new ForbiddenException('Недостаточно прав для изменения поста');
    }

    if (!template.isTemplate) {
      throw new BadRequestException('Это не шаблон объявления');
    }

    const jsonField = (
      value: Prisma.JsonValue | null
    ): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
      value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

    const created = await this.prisma.post.create({
      data: {
        title: template.title,
        ownerId: user.userId,
        type: template.type,
        permissions: template.permissions,
        chips: template.chips,
        description: template.description,
        urgent: template.urgent,
        keyWords: template.keyWords,
        categories: template.categories,
        platforms: template.platforms,
        placementFormats: template.placementFormats,
        niche: template.niche,
        tags: template.tags,
        budget: jsonField(template.budget),
        deadline: template.deadline,
        workFormat: template.workFormat,
        employmentType: template.employmentType,
        location: jsonField(template.location),
        minFollowers: template.minFollowers,
        maxFollowers: template.maxFollowers,
        minEngagementRate: template.minEngagementRate,
        verifiedAccount: template.verifiedAccount,
        experienceWithAds: template.experienceWithAds,
        languages: template.languages,
        contentStyle: template.contentStyle,
        exclusivity: template.exclusivity,
        exclusivityDays: template.exclusivityDays,
        usageRights: template.usageRights,
        usageDurationDays: template.usageDurationDays,
        requiresMarking: template.requiresMarking,
        requiresContract: template.requiresContract,
        ndaRequired: template.ndaRequired,
        brief: jsonField(template.brief),
        deliverables: jsonField(template.deliverables),
        isPrivate: false,
        isTemplate: false,
        isArchived: false,
      },
    });

    const copiedKeys: string[] = [];

    try {
      for (const item of template.media) {
        const extension =
          MIME_TO_EXTENSION[item.mimeType] ??
          item.key.split('.').pop()?.toLowerCase() ??
          'bin';
        const destKey = `posts/${created.id}/${randomUUID()}.${extension}`;

        try {
          await this.storageService.copyObject(
            item.key,
            destKey,
            item.mimeType
          );
        } catch {
          throw new InternalServerErrorException(
            'Не удалось скопировать медиа шаблона'
          );
        }

        copiedKeys.push(destKey);

        await this.prisma.postMedia.create({
          data: {
            postId: created.id,
            url: this.storageService.getPublicUrl(destKey),
            key: destKey,
            size: item.size,
            mimeType: item.mimeType,
            sortOrder: item.sortOrder,
          },
        });
      }
    } catch (error) {
      await this.prisma.post.delete({ where: { id: created.id } }).catch(() => {
        /* ignore rollback failure */
      });

      await Promise.all(
        copiedKeys.map(key =>
          this.storageService.deleteObject(key).catch(() => undefined)
        )
      );

      throw error;
    }

    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: created.id },
      include: postWithMediaInclude,
    });

    return this.toResponse(post);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const post = await this.assertOwner(user.userId, id);

    if (!post.isTemplate) {
      throw new BadRequestException(
        'Объявление нельзя удалить, переместите его в архив'
      );
    }

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
      select: { ownerId: true, isTemplate: true },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    if (post.ownerId !== userId) {
      throw new ForbiddenException('Недостаточно прав для изменения поста');
    }

    return post;
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
    if (dto.isTemplate !== undefined) data.isTemplate = dto.isTemplate;
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
    const bloggerRequirements = columnsToBloggerRequirements(post);
    const cooperationDetails = columnsToCooperationDetails(post);
    const brief = jsonToRecord(post.brief);
    const deliverables = jsonToArray(post.deliverables);

    return {
      id: post.id,
      title: post.title,
      type: post.type,
      chips: post.chips,
      urgent: post.urgent,
      owner: mapOwnerWithStats(post.owner),
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
      isTemplate: post.isTemplate,
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
      ...(post.employmentType && { employmentType: post.employmentType }),
      ...(location && { location: location as PostResponseDto['location'] }),
      ...(bloggerRequirements && { bloggerRequirements }),
      ...(cooperationDetails && { cooperationDetails }),
      ...(brief && { brief: brief as PostResponseDto['brief'] }),
      ...(deliverables &&
        deliverables.length > 0 && {
          deliverables:
            deliverables as unknown as PostResponseDto['deliverables'],
        }),
    };
  }
}
