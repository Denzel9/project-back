import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  NotificationType,
  PostAuthorType,
  Prisma,
  Role,
  Task,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { ActorAttributionService } from '../accounts/actor-attribution.service';
import { buildCalendarDayFilter } from '../common/date/calendar-day-filter';
import { formatApplicationStatus } from '../notifications/notification-labels.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { canViewPost } from '../posts/post-visibility.util';
import { assertMarketplaceTrader } from '../auth/utils/marketplace-participant.util';
import { ApplicationApplicantDto } from './dto/application-applicant.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import {
  mapOwnerWithStats,
  userOwnerWithStatsSelect,
} from '../users/user-stats.util';

const applicantInclude = {
  creatorProfile: true,
  companyProfile: true,
} satisfies Prisma.UserInclude;

const applicationInclude = {
  post: {
    select: {
      id: true,
      title: true,
      type: true,
      ownerId: true,
      media: {
        select: {
          id: true,
          url: true,
          key: true,
          size: true,
          mimeType: true,
        },
      },
      owner: {
        select: userOwnerWithStatsSelect,
      },
    },
  },
  applicant: {
    include: applicantInclude,
  },
} satisfies Prisma.PostApplicationInclude;

type ApplicationWithRelations = Prisma.PostApplicationGetPayload<{
  include: typeof applicationInclude;
}>;

const OWNER_ALLOWED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.VIEWED,
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
];

const OWNER_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.NEW]: [
    ApplicationStatus.VIEWED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.VIEWED]: [
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.ACCEPTED]: [],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WITHDRAWN]: [],
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly notificationsService: NotificationsService,
    private readonly actorAttribution: ActorAttributionService
  ) {}

  async create(
    user: AuthUser,
    dto: CreateApplicationDto
  ): Promise<ApplicationResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: dto.postId },
      select: {
        id: true,
        ownerId: true,
        type: true,
        isArchived: true,
        isPrivate: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    this.assertCanApply(user, post);

    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );

    try {
      const application = await this.prisma.postApplication.create({
        data: {
          postId: dto.postId,
          applicantId: user.userId,
          message: dto.message,
          createdActorAccountId: actor.accountId,
          createdActorDisplayName: actor.displayName,
          createdActorKind: actor.kind,
          lastActorAccountId: actor.accountId,
          lastActorDisplayName: actor.displayName,
          lastActorKind: actor.kind,
        },
        include: applicationInclude,
      });

      await this.notifyPostOwnerAboutApplication(
        application,
        user.userId,
        actor
      );

      return this.mapApplication(application, { includePost: true });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Вы уже откликались на этот пост');
      }

      throw error;
    }
  }

  async getStats(user: AuthUser) {
    const [incomingNew, mineActive] = await Promise.all([
      this.prisma.postApplication.count({
        where: {
          status: ApplicationStatus.NEW,
          post: { ownerId: user.userId },
        },
      }),
      this.prisma.postApplication.count({
        where: {
          applicantId: user.userId,
          status: {
            in: [ApplicationStatus.NEW, ApplicationStatus.VIEWED],
          },
        },
      }),
    ]);

    return { incomingNew, mineActive };
  }

  async listMine(user: AuthUser, query: ListApplicationsQueryDto) {
    const postFilter = this.buildPostListFilter(query);
    const createdAtFilter = buildCalendarDayFilter(query.createdDate);

    return this.listApplications(
      {
        applicantId: user.userId,
        ...(query.status !== undefined && { status: query.status }),
        ...(postFilter !== undefined && { post: postFilter }),
        ...(createdAtFilter !== undefined && { createdAt: createdAtFilter }),
      },
      query,
      { includePost: true }
    );
  }

  async listIncoming(user: AuthUser, query: ListApplicationsQueryDto) {
    const postFilter = this.buildIncomingPostFilter(user.userId, query);
    const createdAtFilter = buildCalendarDayFilter(query.createdDate);

    return this.listApplications(
      {
        post: postFilter,
        ...(query.status !== undefined && { status: query.status }),
        ...(query.userId !== undefined && { applicantId: query.userId }),
        ...(createdAtFilter !== undefined && { createdAt: createdAtFilter }),
      },
      query,
      { includeApplicant: true, includePost: true }
    );
  }

  async listByPost(
    user: AuthUser,
    postId: string,
    query: ListApplicationsQueryDto
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { ownerId: true },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    const isOwner = post.ownerId === user.userId;

    if (!isOwner) {
      const ownApplication = await this.prisma.postApplication.findUnique({
        where: {
          postId_applicantId: {
            postId,
            applicantId: user.userId,
          },
        },
        select: { id: true },
      });

      if (!ownApplication) {
        throw new ForbiddenException(
          'Недостаточно прав для просмотра откликов'
        );
      }
    }

    const createdAtFilter = buildCalendarDayFilter(query.createdDate);

    return this.listApplications(
      {
        postId,
        ...(!isOwner && { applicantId: user.userId }),
        ...(query.status !== undefined && { status: query.status }),
        ...(createdAtFilter !== undefined && { createdAt: createdAtFilter }),
      },
      query,
      { includeApplicant: isOwner }
    );
  }

  async withdraw(user: AuthUser, id: string): Promise<ApplicationResponseDto> {
    const application = await this.findOwnedApplication(id, user.userId);

    if (
      application.status !== ApplicationStatus.NEW &&
      application.status !== ApplicationStatus.VIEWED
    ) {
      throw new BadRequestException('Нельзя отозвать отклик в текущем статусе');
    }

    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );

    const updated = await this.prisma.postApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.WITHDRAWN,
        lastActorAccountId: actor.accountId,
        lastActorDisplayName: actor.displayName,
        lastActorKind: actor.kind,
      },
      include: applicationInclude,
    });

    await this.notificationsService.notify({
      recipientId: updated.post.ownerId,
      actorId: user.userId,
      actor,
      type: NotificationType.APPLICATION_WITHDRAWN,
      title: `Отклик отозван: «${updated.post.title}»`,
      body: `${this.getApplicantDisplayName(updated.applicant)} отозвал отклик`,
      payload: {
        entityType: 'application',
        entityId: updated.id,
        postId: updated.postId,
        applicationId: updated.id,
        meta: {
          postTitle: updated.post.title,
          status: updated.status,
        },
      },
    });

    return this.mapApplication(updated, { includePost: true });
  }

  async updateStatus(
    user: AuthUser,
    id: string,
    dto: UpdateApplicationStatusDto
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.postApplication.findUnique({
      where: { id },
      include: {
        post: { select: { ownerId: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Отклик не найден');
    }

    if (application.post.ownerId !== user.userId) {
      throw new ForbiddenException('Недостаточно прав для изменения статуса');
    }

    const allowed = OWNER_TRANSITIONS[application.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException('Недопустимый переход статуса');
    }

    if (!OWNER_ALLOWED_STATUSES.includes(dto.status)) {
      throw new BadRequestException('Недопустимый статус');
    }

    let createdTask: Task | null = null;
    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );

    const updated = await this.prisma.$transaction(async tx => {
      const application = await tx.postApplication.update({
        where: { id },
        data: {
          status: dto.status,
          lastActorAccountId: actor.accountId,
          lastActorDisplayName: actor.displayName,
          lastActorKind: actor.kind,
        },
        include: applicationInclude,
      });

      if (dto.status === ApplicationStatus.ACCEPTED) {
        createdTask = await this.tasksService.createFromAcceptedApplication(
          tx,
          id,
          actor
        );
      }

      return application;
    });

    await this.notificationsService.notify({
      recipientId: updated.applicantId,
      actorId: user.userId,
      actor,
      type: NotificationType.APPLICATION_STATUS_CHANGED,
      title: `Статус отклика: ${formatApplicationStatus(updated.status)}`,
      body: `Пост «${updated.post.title}»`,
      payload: {
        entityType: 'application',
        entityId: updated.id,
        postId: updated.postId,
        applicationId: updated.id,
        meta: {
          postTitle: updated.post.title,
          status: updated.status,
        },
      },
    });

    if (createdTask) {
      await this.notificationsService.notify({
        recipientId: createdTask.executorId!,
        actorId: user.userId,
        actor,
        type: NotificationType.TASK_CREATED,
        title: `Создана задача по посту «${updated.post.title}»`,
        body: 'Вы назначены исполнителем',
        payload: {
          entityType: 'task',
          entityId: createdTask.id,
          postId: createdTask.postId,
          taskId: createdTask.id,
          applicationId: updated.id,
          meta: {
            postTitle: updated.post.title,
          },
        },
      });
    }

    return this.mapApplication(updated, { includeApplicant: true });
  }

  private buildPostListFilter(
    query: Pick<ListApplicationsQueryDto, 'q' | 'type'>
  ): Prisma.PostWhereInput | undefined {
    const parts: Prisma.PostWhereInput[] = [];

    if (query.q !== undefined) {
      parts.push(this.buildPostSearchWhere(query.q));
    }

    if (query.type !== undefined) {
      parts.push({ type: query.type });
    }

    if (parts.length === 0) {
      return undefined;
    }

    if (parts.length === 1) {
      return parts[0];
    }

    return { AND: parts };
  }

  private buildIncomingPostFilter(
    ownerId: string,
    query: Pick<ListApplicationsQueryDto, 'postId' | 'q' | 'type'>
  ): Prisma.PostWhereInput {
    const parts: Prisma.PostWhereInput[] = [{ ownerId }];

    if (query.postId !== undefined) {
      parts.push({ id: query.postId });
    }

    if (query.q !== undefined) {
      parts.push({
        title: { contains: query.q, mode: 'insensitive' },
      });
    }

    if (query.type !== undefined) {
      parts.push({ type: query.type });
    }

    if (parts.length === 1) {
      return parts[0];
    }

    return { AND: parts };
  }

  private buildPostSearchWhere(q: string): Prisma.PostWhereInput {
    return {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        {
          owner: {
            companyProfile: {
              companyName: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ],
    };
  }

  private async listApplications(
    where: Prisma.PostApplicationWhereInput,
    query: ListApplicationsQueryDto,
    options: {
      includePost?: boolean;
      includeApplicant?: boolean;
      includeOwner?: boolean;
    }
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.postApplication.findMany({
        where,
        include: applicationInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.postApplication.count({ where }),
    ]);

    return {
      items: items.map(item => this.mapApplication(item, options)),
      total,
      page,
      limit,
    };
  }

  private async findOwnedApplication(id: string, applicantId: string) {
    const application = await this.prisma.postApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Отклик не найден');
    }

    if (application.applicantId !== applicantId) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return application;
  }

  private assertCanApply(
    user: AuthUser,
    post: {
      ownerId: string;
      type: PostAuthorType;
      isArchived: boolean;
      isPrivate: boolean;
    }
  ) {
    assertMarketplaceTrader(user.role);

    if (post.ownerId === user.userId) {
      throw new BadRequestException('Нельзя откликнуться на свой пост');
    }

    if (post.isArchived) {
      throw new BadRequestException('Нельзя откликнуться на архивный пост');
    }

    if (post.isPrivate) {
      throw new BadRequestException('Нельзя откликнуться на приватный пост');
    }

    if (!canViewPost(user.role, user.userId, post)) {
      throw new ForbiddenException('Нельзя откликнуться на пост этого типа');
    }
  }

  private async notifyPostOwnerAboutApplication(
    application: ApplicationWithRelations,
    actorId: string,
    actor?: { accountId: string; displayName: string; kind: 'OWNER' | 'MANAGER' }
  ) {
    try {
      await this.notificationsService.notify({
        recipientId: application.post.ownerId,
        actorId,
        actor,
        type: NotificationType.APPLICATION_NEW,
        title: `Новый отклик на «${application.post.title}»`,
        body: `${this.getApplicantDisplayName(application.applicant)}: ${application.message}`,
        payload: {
          entityType: 'application',
          entityId: application.id,
          postId: application.postId,
          applicationId: application.id,
          meta: {
            postTitle: application.post.title,
            applicantName: this.getApplicantDisplayName(application.applicant),
          },
        },
      });
    } catch (error) {
      this.logger.error('Не удалось отправить уведомление о новом отклике', error);
    }
  }

  private getApplicantDisplayName(
    applicant: ApplicationWithRelations['applicant']
  ): string {
    if (applicant.role === Role.CREATOR && applicant.creatorProfile) {
      return `${applicant.creatorProfile.name} ${applicant.creatorProfile.lastName}`.trim();
    }

    if (applicant.role === Role.COMPANY && applicant.companyProfile) {
      return applicant.companyProfile.companyName;
    }

    return applicant.role;
  }

  private mapApplicant(
    applicant: ApplicationWithRelations['applicant']
  ): ApplicationApplicantDto {
    const base: ApplicationApplicantDto = {
      id: applicant.id,
      role: applicant.role,
      avatar: applicant.avatar,
    };

    if (applicant.role === Role.CREATOR && applicant.creatorProfile) {
      return {
        ...base,
        name: applicant.creatorProfile.name,
        lastName: applicant.creatorProfile.lastName,
      };
    }

    if (applicant.role === Role.COMPANY && applicant.companyProfile) {
      return {
        ...base,
        companyName: applicant.companyProfile.companyName,
      };
    }

    return base;
  }

  private mapApplication(
    application: ApplicationWithRelations,
    options: { includePost?: boolean; includeApplicant?: boolean } = {}
  ): ApplicationResponseDto {
    return {
      id: application.id,
      message: application.message,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      createdActorAccountId: application.createdActorAccountId ?? null,
      createdActorDisplayName: application.createdActorDisplayName ?? null,
      createdActorKind: application.createdActorKind ?? null,
      lastActorAccountId: application.lastActorAccountId ?? null,
      lastActorDisplayName: application.lastActorDisplayName ?? null,
      lastActorKind: application.lastActorKind ?? null,
      ...(options.includePost && {
        post: {
          id: application.post.id,
          title: application.post.title,
          type: application.post.type,
          ownerId: application.post.owner.id,
          owner: mapOwnerWithStats(application.post.owner),
          media: application.post.media.map(media => ({
            id: media.id,
            url: media.url,
            key: media.key,
            size: media.size,
            mimeType: media.mimeType,
          })),
        },
      }),
      ...(options.includeApplicant && {
        applicant: this.mapApplicant(application.applicant),
      }),
    };
  }
}
