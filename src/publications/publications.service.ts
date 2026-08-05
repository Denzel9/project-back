import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  Role,
  TaskMediaKind,
  TaskStatus,
} from '@prisma/client';
import { ApplicationApplicantDto } from '../applications/dto/application-applicant.dto';
import { ApplicationOwnerDto } from '../applications/dto/application-owner.dto';
import { AuthUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListPublicationsQueryDto } from './dto/list-publications-query.dto';
import { PublicationListRole } from './dto/publication-list-role.enum';
import { PublicationResponseDto } from './dto/publication-response.dto';
import { UpdatePublicationDto } from './dto/update-publication.dto';
import {
  mapOwnerWithStats,
  userStatsCountSelect,
} from '../users/user-stats.util';

const participantUserInclude = {
  creatorProfile: true,
  companyProfile: true,
  _count: {
    select: userStatsCountSelect,
  },
} satisfies Prisma.UserInclude;

export const publicationInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
  post: {
    select: {
      id: true,
      title: true,
    },
  },
  owner: {
    include: participantUserInclude,
  },
  executor: {
    include: participantUserInclude,
  },
} satisfies Prisma.PublicationInclude;

type PublicationWithRelations = Prisma.PublicationGetPayload<{
  include: typeof publicationInclude;
}>;

@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async createFromCompletedTask(taskId: string, actorId: string): Promise<void> {
    const existing = await this.prisma.publication.findUnique({
      where: { taskId },
      select: { id: true },
    });

    if (existing) {
      return;
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        post: { select: { title: true } },
        media: {
          where: { kind: TaskMediaKind.REPORT },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!task || task.status !== TaskStatus.COMPLETED) {
      return;
    }

    const publication = await this.prisma.$transaction(async tx => {
      const created = await tx.publication.create({
        data: {
          taskId: task.id,
          postId: task.postId,
          ownerId: task.ownerId,
          executorId: task.executorId,
          title: task.title ?? task.post.title,
          description: task.description,
          brief: task.brief ?? Prisma.JsonNull,
          deliverables: task.deliverables ?? Prisma.JsonNull,
          location: task.location ?? Prisma.JsonNull,
          ...(task.media.length > 0 && {
            media: {
              create: task.media.map((item, index) => ({
                sourceTaskMediaId: item.id,
                url: item.url,
                key: item.key,
                size: item.size,
                mimeType: item.mimeType,
                sortOrder: index,
              })),
            },
          }),
        },
        include: publicationInclude,
      });

      return created;
    });

    const recipientId = this.resolveOtherParticipantId(publication, actorId);

    if (recipientId) {
      await this.notificationsService.notify({
        recipientId,
        actorId,
        type: NotificationType.PUBLICATION_CREATED,
        title: 'Создана публикация по задаче',
        body: publication.title ? `«${publication.title}»` : undefined,
        payload: {
          entityType: 'publication',
          entityId: publication.id,
          postId: publication.postId,
          taskId: publication.taskId,
          meta: {
            title: publication.title,
            mediaCount: publication.media.length,
          },
        },
      });
    }
  }

  async list(user: AuthUser, query: ListPublicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PublicationWhereInput = {
      ...this.buildParticipantWhere(user.userId, query.role),
      ...(query.postId !== undefined && { postId: query.postId }),
      ...(query.taskId !== undefined && { taskId: query.taskId }),
      ...(query.ownerId !== undefined && { ownerId: query.ownerId }),
      ...(query.executorId !== undefined && { executorId: query.executorId }),
      ...(query.q !== undefined && {
        title: { contains: query.q, mode: 'insensitive' },
      }),
      ...(query.executorQ !== undefined && {
        executor: {
          OR: [
            {
              creatorProfile: {
                name: { contains: query.executorQ, mode: 'insensitive' },
              },
            },
            {
              creatorProfile: {
                lastName: { contains: query.executorQ, mode: 'insensitive' },
              },
            },
          ],
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: publicationInclude,
      }),
      this.prisma.publication.count({ where }),
    ]);

    return {
      items: items.map(item => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async findById(user: AuthUser, id: string): Promise<PublicationResponseDto> {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
      include: publicationInclude,
    });

    if (!publication) {
      throw new NotFoundException('Публикация не найдена');
    }

    this.assertParticipant(publication, user.userId);

    return this.toResponse(publication);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdatePublicationDto
  ): Promise<PublicationResponseDto> {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
      include: publicationInclude,
    });

    if (!publication) {
      throw new NotFoundException('Публикация не найдена');
    }

    this.assertParticipant(publication, user.userId);

    const updated = await this.prisma.publication.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.externalUrl !== undefined && { externalUrl: dto.externalUrl }),
        ...(dto.platform !== undefined && { platform: dto.platform }),
      },
      include: publicationInclude,
    });

    return this.toResponse(updated);
  }

  private buildParticipantWhere(
    userId: string,
    role?: PublicationListRole
  ): Prisma.PublicationWhereInput {
    if (role === PublicationListRole.OWNER) {
      return { ownerId: userId };
    }

    if (role === PublicationListRole.EXECUTOR) {
      return { executorId: userId };
    }

    return {
      OR: [{ ownerId: userId }, { executorId: userId }],
    };
  }

  private assertParticipant(
    publication: { ownerId: string; executorId: string | null },
    userId: string
  ): void {
    if (
      publication.ownerId !== userId &&
      publication.executorId !== userId
    ) {
      throw new ForbiddenException('Нет доступа к публикации');
    }
  }

  private resolveOtherParticipantId(
    publication: { ownerId: string; executorId: string | null },
    actorId: string
  ): string | null {
    if (publication.ownerId === actorId) {
      return publication.executorId;
    }

    if (publication.executorId === actorId) {
      return publication.ownerId;
    }

    return null;
  }

  private toResponse(
    publication: PublicationWithRelations
  ): PublicationResponseDto {
    return {
      id: publication.id,
      taskId: publication.taskId,
      postId: publication.postId,
      post: publication.post
        ? {
            id: publication.post.id,
            title: publication.post.title,
          }
        : null,
      title: publication.title,
      description: publication.description,
      externalUrl: publication.externalUrl,
      platform: publication.platform,
      brief: this.jsonToRecord(publication.brief),
      deliverables: publication.deliverables,
      location: this.jsonToRecord(publication.location),
      status: publication.status,
      publishedAt: publication.publishedAt.toISOString(),
      createdAt: publication.createdAt.toISOString(),
      updatedAt: publication.updatedAt.toISOString(),
      media: publication.media.map(item => ({
        id: item.id,
        sourceTaskMediaId: item.sourceTaskMediaId,
        url: item.url,
        key: item.key,
        size: item.size,
        mimeType: item.mimeType,
      })),
      owner: this.mapOwner(publication.owner),
      executor: publication.executor
        ? this.mapExecutor(publication.executor)
        : null,
    };
  }

  private jsonToRecord(
    value: Prisma.JsonValue | null
  ): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private mapOwner(user: PublicationWithRelations['owner']): ApplicationOwnerDto {
    return mapOwnerWithStats(user);
  }

  private mapExecutor(
    user: NonNullable<PublicationWithRelations['executor']>
  ): ApplicationApplicantDto {
    const base: ApplicationApplicantDto = {
      id: user.id,
      role: user.role,
      avatar: user.avatar,
    };

    if (user.role === Role.CREATOR && user.creatorProfile) {
      return {
        ...base,
        name: user.creatorProfile.name,
        lastName: user.creatorProfile.lastName,
      };
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return {
        ...base,
        companyName: user.companyProfile.companyName,
      };
    }

    return base;
  }
}
