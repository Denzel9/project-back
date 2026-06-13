import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Post, PostAuthorType, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';

export const postWithMediaInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.PostInclude;

export type PostWithMedia = Post & {
  media: {
    url: string;
    key: string;
    size: string;
    mimeType: string;
    sortOrder: number;
  }[];
};

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

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
        typeCooperation: dto.typeCooperation,
        urgent: dto.urgent ?? false,
        contentType: dto.contentType,
        photoCount: dto.photoCount ?? '0',
        videoCount: dto.videoCount ?? '0',
        finalPrice: dto.finalPrice ?? '',
        rangePrice: dto.rangePrice ?? [],
        keyWords: dto.keyWords ?? [],
        categories: dto.categories ?? [],
      },
      include: postWithMediaInclude,
    });

    return this.toResponse(post);
  }

  async findById(id: string): Promise<PostResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postWithMediaInclude,
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    return this.toResponse(post);
  }

  async list(user: AuthUser, query: ListPostsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const isFeed = query.ownerId === undefined;

    const where: Prisma.PostWhereInput = {
      ...(isFeed
        ? {
            ownerId: { not: user.userId },
            type: this.oppositePostAuthorType(user.role),
          }
        : {
            ownerId: query.ownerId,
            ...(query.type !== undefined && { type: query.type }),
          }),
      ...(query.isArchived !== undefined && { isArchived: query.isArchived }),
    };

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: postWithMediaInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map((post) => this.toResponse(post)),
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
      throw new ForbiddenException('Недостаточно прав для загрузки в этот пост');
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

  private oppositePostAuthorType(role: Role): PostAuthorType {
    if (role === Role.CREATOR) {
      return PostAuthorType.COMPANY;
    }

    if (role === Role.COMPANY) {
      return PostAuthorType.CREATOR;
    }

    throw new BadRequestException('Недопустимая роль');
  }

  private buildUpdateData(dto: UpdatePostDto): Prisma.PostUpdateInput {
    const data: Prisma.PostUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.permissions !== undefined) data.permissions = dto.permissions;
    if (dto.chips !== undefined) data.chips = dto.chips;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.typeCooperation !== undefined) {
      data.typeCooperation = dto.typeCooperation;
    }
    if (dto.urgent !== undefined) data.urgent = dto.urgent;
    if (dto.contentType !== undefined) data.contentType = dto.contentType;
    if (dto.photoCount !== undefined) data.photoCount = dto.photoCount;
    if (dto.videoCount !== undefined) data.videoCount = dto.videoCount;
    if (dto.finalPrice !== undefined) data.finalPrice = dto.finalPrice;
    if (dto.rangePrice !== undefined) data.rangePrice = dto.rangePrice;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;
    if (dto.keyWords !== undefined) data.keyWords = dto.keyWords;
    if (dto.categories !== undefined) data.categories = dto.categories;

    return data;
  }

  toResponse(post: PostWithMedia): PostResponseDto {
    return {
      id: post.id,
      permissions: post.permissions,
      media: post.media.map((item) => ({
        url: item.url,
        key: item.key,
        size: item.size,
        mimeType: item.mimeType,
      })),
      title: post.title,
      ownerId: post.ownerId,
      chips: post.chips,
      description: post.description,
      typeCooperation: post.typeCooperation,
      urgent: post.urgent,
      contentType: post.contentType,
      photoCount: post.photoCount,
      videoCount: post.videoCount,
      finalPrice: post.finalPrice,
      rangePrice: post.rangePrice,
      isArchived: post.isArchived,
      keyWords: post.keyWords,
      categories: post.categories,
      type: post.type,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
