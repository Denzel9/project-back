import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Prisma,
  Role,
  Task,
  TaskActivityType,
  TaskMediaKind,
  TaskRequestInitiator,
  TaskRequestStatus,
  TaskStatus,
  NotificationType,
} from '@prisma/client';
import { ApplicationApplicantDto } from '../applications/dto/application-applicant.dto';
import { AuthUser } from '../auth/auth.types';
import {
  ActorAttributionService,
  type ActorSnapshot,
} from '../accounts/actor-attribution.service';
import {
  mapOwnerWithStats,
  userOwnerWithStatsSelect,
} from '../users/user-stats.util';
import {
  buildCalendarDayFilter,
  buildCalendarDateRangeFilter,
} from '../common/date/calendar-day-filter';
import {
  buildCompanyNameSearch,
  buildCreatorNameSearch,
} from '../partners/partner-filters.util';
import { StorageService } from '../media/storage.service';
import { ALLOWED_DOCUMENT_MIME_TYPES } from '../media/media.constants';
import { formatTaskStatus } from '../notifications/notification-labels.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PublicationsService } from '../publications/publications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { TaskCommentMediaInputDto } from './dto/task-comment-media-input.dto';
import { ListTaskActivitiesQueryDto } from './dto/list-task-activities-query.dto';
import { ListAllTaskActivitiesQueryDto } from './dto/list-all-task-activities-query.dto';
import { ListAllTaskCommentsQueryDto } from './dto/list-all-task-comments-query.dto';
import { ListTasksWithCommentsQueryDto } from './dto/list-tasks-with-comments-query.dto';
import { ListTaskCommentsQueryDto } from './dto/list-task-comments-query.dto';
import {
  ListTaskCommentAttachmentsQueryDto,
  TaskCommentAttachmentTypeFilter,
} from './dto/list-task-comment-attachments-query.dto';
import {
  ListTaskAttachmentsQueryDto,
  TaskAttachmentKindFilter,
  TaskAttachmentTypeFilter,
} from './dto/list-task-attachments-query.dto';
import { TaskAttachmentResponseDto } from './dto/task-attachment-response.dto';
import { SearchTaskCommentsQueryDto } from './dto/search-task-comments-query.dto';
import { TaskCommentAttachmentResponseDto } from './dto/task-comment-attachment-response.dto';
import { ListTasksQueryDto, TaskListPersonField, TaskListRole } from './dto/list-tasks-query.dto';
import { ListTasksCalendarQueryDto } from './dto/list-tasks-calendar-query.dto';
import { ListTaskStatsQueryDto } from './dto/list-task-stats-query.dto';
import { TaskStatsResponseDto } from './dto/task-stats-response.dto';
import { TaskCalendarDateField } from './dto/task-calendar-date-field.enum';
import {
  TaskCalendarItemDto,
  TaskCalendarParticipantDto,
} from './dto/task-calendar-item.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import {
  RequestTaskAnnulmentDto,
  TaskAnnulmentDto,
  TaskAnnulmentInitiator,
  TaskAnnulmentStatus,
} from './dto/task-annulment.dto';
import {
  RequestTaskDeadlineExtensionDto,
  TaskDeadlineExtensionDto,
  TaskDeadlineExtensionStatus,
} from './dto/task-deadline-extension.dto';
import { TaskActivityResponseDto } from './dto/task-activity-response.dto';
import {
  TaskCommentResponseDto,
  TaskResponseDto,
} from './dto/task-response.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskWithCommentsSummaryDto } from './dto/task-with-comments-summary.dto';
import type { TaskWithCommentsRecipientDto } from './dto/task-with-comments-summary.dto';
import {
  buildCommentPreview,
  resolveTaskTitle,
} from './task-comment-preview.util';
import {
  countUnreadComments,
  isCommentRead,
} from './task-comment-read.util';
import { TaskCommentsGateway } from './task-comments.gateway';
import { taskJsonFieldsFromDto } from './task-json-fields.util';
import { jsonToArray, jsonToRecord } from '../posts/post-json.util';
import {
  columnsToBloggerRequirements,
  columnsToCooperationDetails,
} from '../posts/blogger-coop-fields.util';

type PrismaTx = Prisma.TransactionClient;

const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.ANNULLED,
];

export const taskWithMediaInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
  annulmentRequests: {
    orderBy: { requestedAt: 'desc' as const },
  },
  deadlineExtensionRequests: {
    orderBy: { requestedAt: 'desc' as const },
  },
} satisfies Prisma.TaskInclude;

const executorInclude = {
  creatorProfile: true,
  companyProfile: true,
} satisfies Prisma.UserInclude;

export const taskListInclude = {
  ...taskWithMediaInclude,
  post: {
    select: {
      id: true,
      title: true,
      type: true,
      ownerId: true,
      isPrivate: true,
    },
  },
  owner: {
    select: userOwnerWithStatsSelect,
  },
  executor: {
    include: executorInclude,
  },
} satisfies Prisma.TaskInclude;

const taskCalendarInclude = {
  post: {
    select: {
      title: true,
    },
  },
  owner: {
    include: executorInclude,
  },
  executor: {
    include: executorInclude,
  },
} satisfies Prisma.TaskInclude;

type TaskCalendarItem = Prisma.TaskGetPayload<{
  include: typeof taskCalendarInclude;
}>;

const commentWithMediaInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.TaskCommentInclude;

type TaskListItem = Prisma.TaskGetPayload<{
  include: typeof taskListInclude;
}>;

export type TaskWithMedia = Task & {
  media: {
    id: string;
    url: string;
    key: string;
    size: string;
    mimeType: string;
    kind: TaskMediaKind;
  }[];
  annulmentRequests?: Array<{
    id: string;
    reason: string;
    initiator: TaskRequestInitiator;
    status: TaskRequestStatus;
    requestedAt: Date;
    requestedById: string;
    confirmedAt: Date | null;
    confirmedById: string | null;
  }>;
  deadlineExtensionRequests?: Array<{
    id: string;
    reason: string;
    initiator: TaskRequestInitiator;
    status: TaskRequestStatus;
    proposedFinalDate: Date;
    requestedAt: Date;
    requestedById: string;
    confirmedAt: Date | null;
    confirmedById: string | null;
  }>;
};

type TaskWithRelations = TaskWithMedia;

type TaskChange = {
  type: TaskActivityType;
  payload: Prisma.InputJsonValue;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly publicationsService: PublicationsService,
    private readonly actorAttribution: ActorAttributionService,
    @Inject(forwardRef(() => TaskCommentsGateway))
    private readonly taskCommentsGateway: TaskCommentsGateway
  ) {}

  async createFromAcceptedApplication(
    tx: PrismaTx,
    applicationId: string,
    assignee?: ActorSnapshot | null
  ): Promise<Task> {
    const application = await tx.postApplication.findUnique({
      where: { id: applicationId },
      include: { post: true },
    });

    if (!application) {
      throw new NotFoundException('Отклик не найден');
    }

    const existingByApplication = await tx.task.findUnique({
      where: { applicationId },
    });

    if (existingByApplication) {
      throw new ConflictException('Задача для этого отклика уже существует');
    }

    return tx.task.create({
      data: {
        applicationId,
        postId: application.postId,
        ownerId: application.post.ownerId,
        executorId: application.applicantId,
        urgent: application.post.urgent,
        isExecutorApprove: true,
        ...(assignee && {
          assigneeAccountId: assignee.accountId,
          assigneeDisplayName: assignee.displayName,
          assigneeKind: assignee.kind,
        }),
      },
    });
  }

  async create(user: AuthUser, dto: CreateTaskDto): Promise<TaskResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: dto.postId },
      select: {
        id: true,
        ownerId: true,
        urgent: true,
        isArchived: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    if (post.ownerId !== user.userId) {
      throw new ForbiddenException(
        'Создавать задачу может только владелец поста'
      );
    }

    if (post.isArchived) {
      throw new BadRequestException(
        'Нельзя создать задачу для архивного поста'
      );
    }

    if (dto.executorId !== undefined) {
      await this.validateExecutor(dto.executorId, post.ownerId);
    }

    const assignee = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );

    const task = await this.prisma.task.create({
      data: {
        postId: dto.postId,
        ownerId: post.ownerId,
        executorId: dto.executorId ?? null,
        description: dto.description ?? '',
        ...(dto.title !== undefined && { title: dto.title }),
        status: dto.status ?? TaskStatus.PREPARING,
        finalDate:
          dto.finalDate === undefined
            ? undefined
            : dto.finalDate === null
              ? null
              : new Date(dto.finalDate),
        photoCount: dto.photoCount ?? '0',
        videoCount: dto.videoCount ?? '0',
        urgent: dto.urgent ?? post.urgent,
        isExecutorApprove: null,
        assigneeAccountId: assignee.accountId,
        assigneeDisplayName: assignee.displayName,
        assigneeKind: assignee.kind,
        ...(dto.isCompanyAction !== undefined && {
          isCompanyAction: dto.isCompanyAction,
        }),
        ...taskJsonFieldsFromDto(dto),
      },
      include: taskListInclude,
    });

    const media = dto.media ?? [];

    if (media.length > 0) {
      const preparedMedia = await this.prepareCreateTaskMedia(
        task.id,
        task.postId,
        post.ownerId,
        media
      );

      for (const item of preparedMedia) {
        await this.addMedia(task.id, user.userId, item, item.kind);
      }
    }

    const taskWithMedia =
      media.length > 0
        ? await this.prisma.task.findUniqueOrThrow({
          where: { id: task.id },
          include: taskListInclude,
        })
        : task;

    if (task.executorId) {
      const title = task.title ?? task.post.title;
      await this.notificationsService.notify({
        recipientId: task.executorId,
        actorId: user.userId,
        actor: assignee,
        type: NotificationType.TASK_CREATED,
        title: `Создана задача «${title}»`,
        body: 'Вы назначены исполнителем',
        payload: {
          entityType: 'task',
          entityId: task.id,
          postId: task.postId,
          taskId: task.id,
          meta: { postTitle: task.post.title, taskTitle: task.title },
        },
      });
    }

    return this.toResponse(taskWithMedia, {
      includePost: true,
      includeExecutor: true,
      includeOwner: true,
    });
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        media: { select: { key: true } },
        comments: {
          include: {
            media: { select: { key: true } },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    if (task.ownerId !== user.userId) {
      throw new ForbiddenException(
        'Удалять задачу может только владелец поста'
      );
    }

    const mediaKeys = [
      ...task.media.map(item => item.key),
      ...task.comments.flatMap(comment => comment.media.map(item => item.key)),
    ];

    for (const key of mediaKeys) {
      try {
        await this.storageService.deleteObject(key);
      } catch {
        throw new InternalServerErrorException(
          'Не удалось удалить файлы задачи'
        );
      }
    }

    await this.prisma.task.delete({
      where: { id },
    });
  }

  async list(user: AuthUser, query: ListTasksQueryDto) {
    return this.queryTasks(user, query);
  }

  async listPendingApproval(user: AuthUser, query: ListTasksQueryDto) {
    return this.queryTasks(user, query, {
      executorApprovalFilter: 'unapproved',
      forceExecutorRole: true,
    });
  }

  async getStats(
    user: AuthUser,
    query: ListTaskStatsQueryDto
  ): Promise<TaskStatsResponseDto> {
    const baseWhere = this.buildStatsBaseWhere(user, query);
    const activeWhere: Prisma.TaskWhereInput = {
      ...baseWhere,
      status: { notIn: TERMINAL_TASK_STATUSES },
    };
    const now = new Date();

    const [
      awaitingAction,
      awaitingConfirmation,
      unassigned,
      overdue,
      urgent,
      underReview,
      cancelled,
    ] = await Promise.all([
      this.prisma.task.count({
        where: this.buildAwaitingActionWhere(
          user.userId,
          query.role,
          activeWhere
        ),
      }),
      this.prisma.task.count({
        where: {
          ...activeWhere,
          isExecutorApprove: null,
          executorId: { not: null },
        },
      }),
      query.role === TaskListRole.EXECUTOR
        ? Promise.resolve(0)
        : this.prisma.task.count({
          where: {
            ...activeWhere,
            ownerId: user.userId,
            executorId: null,
            isExecutorApprove: null,
          },
        }),
      this.prisma.task.count({
        where: {
          ...activeWhere,
          finalDate: { lt: now },
        },
      }),
      this.prisma.task.count({
        where: {
          ...activeWhere,
          urgent: true,
        },
      }),
      this.prisma.task.count({
        where: {
          ...baseWhere,
          status: TaskStatus.CHECKING,
        },
      }),
      this.prisma.task.count({
        where: {
          ...baseWhere,
          status: {
            in: [TaskStatus.ANNULLED],
          },
        },
      }),
    ]);

    return {
      awaitingAction,
      awaitingConfirmation,
      unassigned,
      overdue,
      urgent,
      underReview,
      cancelled,
    };
  }

  async listCalendar(user: AuthUser, query: ListTasksCalendarQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const skip = (page - 1) * limit;
    const dateField = query.dateField ?? TaskCalendarDateField.CREATED_AT;
    const where = this.buildCalendarWhere(user, query);

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: { [dateField]: 'asc' },
        skip,
        take: limit,
        include: taskCalendarInclude,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: items.map(task => this.toCalendarItem(task)),
      total,
      page,
      limit,
    };
  }

  private buildCalendarWhere(
    user: AuthUser,
    query: ListTasksCalendarQueryDto
  ): Prisma.TaskWhereInput {
    const { userId, accountId } = user;
    const dateRangeFilter = buildCalendarDateRangeFilter(
      query.dateFrom,
      query.dateTo
    );
    const dateField = query.dateField ?? TaskCalendarDateField.CREATED_AT;

    return {
      ...this.buildParticipantTaskWhere(userId, query.role),
      ...(query.ownerId !== undefined && { ownerId: query.ownerId }),
      ...(query.executorId !== undefined && { executorId: query.executorId }),
      ...(query.postId !== undefined && { postId: query.postId }),
      ...(query.urgent !== undefined && { urgent: query.urgent }),
      ...(query.assigneeMine === true && { assigneeAccountId: accountId }),
      ...(query.assigneeAccountId !== undefined &&
        query.assigneeMine !== true && {
          assigneeAccountId: query.assigneeAccountId,
        }),
      ...(dateRangeFilter !== undefined && {
        [dateField]: dateRangeFilter,
      }),
    };
  }

  private toCalendarItem(task: TaskCalendarItem): TaskCalendarItemDto {
    return {
      id: task.id,
      postId: task.postId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      urgent: task.urgent,
      finalDate: task.finalDate?.toISOString() ?? null,
      title: resolveTaskTitle(task.title, task.post.title),
      owner: this.mapCalendarParticipant(task.owner),
      executor: task.executor
        ? this.mapCalendarParticipant(task.executor)
        : null,
    };
  }

  private mapCalendarParticipant(user: {
    id: string;
    role: Role;
    avatar: string | null;
    creatorProfile: { name: string; lastName: string } | null;
    companyProfile: { companyName: string } | null;
  }): TaskCalendarParticipantDto {
    const base: TaskCalendarParticipantDto = {
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

  private mapCommentsRecipient(user: {
    id: string;
    role: Role;
    avatar: string | null;
    creatorProfile: { name: string; lastName: string } | null;
    companyProfile: { companyName: string } | null;
  }): TaskWithCommentsRecipientDto {
    if (user.role === Role.CREATOR && user.creatorProfile) {
      return {
        id: user.id,
        avatar: user.avatar,
        displayName: `${user.creatorProfile.name} ${user.creatorProfile.lastName}`.trim(),
      };
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return {
        id: user.id,
        avatar: user.avatar,
        displayName: user.companyProfile.companyName,
      };
    }

    return {
      id: user.id,
      avatar: user.avatar,
      displayName: user.role,
    };
  }

  private async queryTasks(
    user: AuthUser,
    query: ListTasksQueryDto,
    options: {
      executorApprovalFilter?: 'unapproved';
      forceExecutorRole?: boolean;
    } = {}
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(user, query, options);

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: taskListInclude,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: items.map(task =>
        this.toResponse(
          task,
          this.participantResponseOptions(user.userId, task)
        )
      ),
      total,
      page,
      limit,
    };
  }

  private buildListWhere(
    user: Pick<AuthUser, 'userId' | 'accountId'>,
    query: ListTasksQueryDto,
    options: {
      executorApprovalFilter?: 'unapproved';
      forceExecutorRole?: boolean;
    } = {}
  ): Prisma.TaskWhereInput {
    const { userId, accountId } = user;
    const hasDateRange =
      query.dateFrom !== undefined || query.dateTo !== undefined;

    if (query.createdDate !== undefined && hasDateRange) {
      throw new BadRequestException(
        'Нельзя одновременно использовать createdDate и dateFrom/dateTo'
      );
    }

    const createdAtDayFilter = buildCalendarDayFilter(
      query.createdDate,
      query.tzOffset
    );
    const updatedAtDayFilter = buildCalendarDayFilter(
      query.updatedDate,
      query.tzOffset
    );
    const deadlineDayFilter = buildCalendarDayFilter(
      query.deadlineDate,
      query.tzOffset
    );
    const dateRangeFilter = buildCalendarDateRangeFilter(
      query.dateFrom,
      query.dateTo,
      query.tzOffset
    );
    const dateField = query.dateField ?? TaskCalendarDateField.CREATED_AT;
    const role = options.forceExecutorRole ? TaskListRole.EXECUTOR : query.role;
    const executorApprovalWhere =
      options.executorApprovalFilter === 'unapproved'
        ? { isExecutorApprove: null }
        : {};
    const statusFilter = this.resolveTaskStatusFilter(query);
    const unassignedWhere = this.buildUnassignedListWhere(
      userId,
      query,
      role
    );

    const where: Prisma.TaskWhereInput = {
      ...(role === TaskListRole.OWNER && { ownerId: userId }),
      ...(role === TaskListRole.EXECUTOR && {
        executorId: userId,
        ...executorApprovalWhere,
      }),
      ...(role === undefined && {
        OR: [
          { ownerId: userId },
          { executorId: userId, ...executorApprovalWhere },
        ],
      }),
      ...(statusFilter !== undefined && { status: statusFilter }),
      ...(query.postId !== undefined && { postId: query.postId }),
      ...(query.ownerId !== undefined && { ownerId: query.ownerId }),
      ...(query.executorId !== undefined && { executorId: query.executorId }),
      ...(query.taskId !== undefined && { id: query.taskId }),
      ...(createdAtDayFilter !== undefined && {
        createdAt: createdAtDayFilter,
      }),
      ...(updatedAtDayFilter !== undefined && {
        updatedAt: updatedAtDayFilter,
      }),
      ...(deadlineDayFilter !== undefined && {
        finalDate: deadlineDayFilter,
      }),
      ...(dateRangeFilter !== undefined && {
        [dateField]: dateRangeFilter,
      }),
      ...(query.q !== undefined && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { post: this.buildPostSearchWhere(query.q) },
        ],
      }),
      ...this.buildPersonSearchWhere(query),
      ...(query.isCompanyAction !== undefined && {
        isCompanyAction: query.isCompanyAction,
      }),
      ...(query.isExecutorApprove !== undefined &&
        options.executorApprovalFilter !== 'unapproved' && {
          isExecutorApprove: query.isExecutorApprove,
          ...(query.isExecutorApprove === null &&
            query.unassigned !== true && {
              executorId: { not: null },
            }),
        }),
      ...(query.urgent !== undefined && { urgent: query.urgent }),
      ...(query.assigneeMine === true && { assigneeAccountId: accountId }),
      ...(query.assigneeAccountId !== undefined &&
        query.assigneeMine !== true && {
          assigneeAccountId: query.assigneeAccountId,
        }),
      ...(query.overdue === true && {
        finalDate: { lt: new Date() },
      }),
      ...unassignedWhere,
    };

    return where;
  }

  private buildPersonSearchWhere(
    query: ListTasksQueryDto
  ): Prisma.TaskWhereInput {
    if (query.personQ === undefined) {
      return {};
    }

    const personField =
      query.personField ??
      (query.role === TaskListRole.OWNER
        ? TaskListPersonField.EXECUTOR
        : TaskListPersonField.OWNER);

    if (personField === TaskListPersonField.EXECUTOR) {
      return {
        executorId: { not: null },
        executor: buildCreatorNameSearch(query.personQ),
      };
    }

    return {
      owner: buildCompanyNameSearch(query.personQ),
    };
  }

  private resolveStatuses(
    status?: TaskStatus,
    statuses?: TaskStatus[]
  ): TaskStatus[] | undefined {
    if (statuses !== undefined && statuses.length > 0) {
      return statuses;
    }

    if (status !== undefined) {
      return [status];
    }

    return undefined;
  }

  private resolveTaskStatusFilter(
    query: ListTasksQueryDto
  ): Prisma.EnumTaskStatusFilter | undefined {
    const explicit = this.resolveStatuses(query.status, query.statuses);

    if (explicit !== undefined) {
      let allowed = explicit;

      if (query.active === true) {
        allowed = allowed.filter(
          status => !TERMINAL_TASK_STATUSES.includes(status)
        );
      } else if (query.excludeCompleted === true) {
        allowed = allowed.filter(status => status !== TaskStatus.COMPLETED);
      }

      if (allowed.length === 0) {
        return { in: [] };
      }

      return allowed.length === 1
        ? { equals: allowed[0] }
        : { in: allowed };
    }

    if (query.active === true) {
      return { notIn: TERMINAL_TASK_STATUSES };
    }

    if (query.excludeCompleted === true) {
      return { not: TaskStatus.COMPLETED };
    }

    return undefined;
  }

  private buildUnassignedListWhere(
    userId: string,
    query: ListTasksQueryDto,
    role?: TaskListRole
  ): Prisma.TaskWhereInput {
    if (query.unassigned !== true) {
      return {};
    }

    if (role === TaskListRole.EXECUTOR) {
      return {
        AND: [{ executorId: userId }, { executorId: null }],
      };
    }

    if (role === TaskListRole.OWNER) {
      return { executorId: null, isExecutorApprove: null };
    }

    return {
      ownerId: userId,
      executorId: null,
      isExecutorApprove: null,
    };
  }

  private buildParticipantTaskWhere(
    userId: string,
    role?: TaskListRole
  ): Prisma.TaskWhereInput {
    if (role === TaskListRole.OWNER) {
      return { ownerId: userId };
    }

    if (role === TaskListRole.EXECUTOR) {
      return { executorId: userId };
    }

    return {
      OR: [{ ownerId: userId }, { executorId: userId }],
    };
  }

  private buildStatsBaseWhere(
    user: AuthUser,
    query: ListTaskStatsQueryDto
  ): Prisma.TaskWhereInput {
    const { userId, accountId } = user;
    const dateRangeFilter = buildCalendarDateRangeFilter(
      query.dateFrom,
      query.dateTo
    );
    const dateField = query.dateField ?? TaskCalendarDateField.FINAL_DATE;

    return {
      ...this.buildParticipantTaskWhere(userId, query.role),
      ...(query.postId !== undefined && { postId: query.postId }),
      ...(query.executorId !== undefined && { executorId: query.executorId }),
      ...(query.ownerId !== undefined && { ownerId: query.ownerId }),
      ...(dateRangeFilter !== undefined && {
        [dateField]: dateRangeFilter,
      }),
      ...(query.assigneeMine === true && { assigneeAccountId: accountId }),
      ...(query.assigneeAccountId !== undefined &&
        query.assigneeMine !== true && {
          assigneeAccountId: query.assigneeAccountId,
        }),
    };
  }

  private buildAwaitingActionWhere(
    userId: string,
    role: TaskListRole | undefined,
    activeWhere: Prisma.TaskWhereInput
  ): Prisma.TaskWhereInput {
    if (role === TaskListRole.OWNER) {
      return {
        ...activeWhere,
        isCompanyAction: true,
      };
    }

    if (role === TaskListRole.EXECUTOR) {
      return {
        ...activeWhere,
        isCompanyAction: false,
      };
    }

    return {
      AND: [
        activeWhere,
        {
          OR: [
            { ownerId: userId, isCompanyAction: true },
            { executorId: userId, isCompanyAction: false },
          ],
        },
      ],
    };
  }

  private buildTasksWithCommentsWhere(
    userId: string,
    query: ListTasksWithCommentsQueryDto
  ): Prisma.TaskCommentWhereInput {
    const taskWhere: Prisma.TaskWhereInput = {
      ...this.buildParticipantTaskWhere(userId, query.role),
      ...(query.postId !== undefined && { postId: query.postId }),
      ...(query.taskId !== undefined && { id: query.taskId }),
      ...(query.status !== undefined && { status: query.status }),
    };

    if (query.q === undefined) {
      return { task: taskWhere };
    }

    return {
      AND: [
        { task: taskWhere },
        {
          OR: [
            { content: { contains: query.q, mode: 'insensitive' } },
            {
              task: {
                ...taskWhere,
                title: { contains: query.q, mode: 'insensitive' },
              },
            },
            {
              task: {
                ...taskWhere,
                post: {
                  title: { contains: query.q, mode: 'insensitive' },
                },
              },
            },
          ],
        },
      ],
    };
  }

  private async countUnreadCommentsByTask(
    userId: string,
    taskIds: string[]
  ): Promise<Map<string, number>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const readStates = await this.prisma.taskCommentReadState.findMany({
      where: { userId, taskId: { in: taskIds } },
      select: { taskId: true, lastReadAt: true },
    });
    const lastReadByTask = new Map(
      readStates.map(state => [state.taskId, state.lastReadAt])
    );

    const entries = await Promise.all(
      taskIds.map(async taskId => {
        const count = await countUnreadComments(
          this.prisma,
          taskId,
          userId,
          lastReadByTask.get(taskId) ?? null
        );
        return [taskId, count] as const;
      })
    );

    return new Map(entries);
  }

  async findById(user: AuthUser, id: string): Promise<TaskResponseDto> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskListInclude,
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    this.assertParticipant(task, user.userId);

    return this.toResponse(
      task,
      this.participantResponseOptions(user.userId, task)
    );
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateTaskDto
  ): Promise<TaskResponseDto> {
    if (dto.status === TaskStatus.ANNULLED) {
      throw new BadRequestException(
        'Статус ANNULLED устанавливается только через подтверждение аннулирования'
      );
    }

    const task = await this.getTaskOrThrow(id);
    this.assertParticipant(task, user.userId);

    const isOwner = task.ownerId === user.userId;

    if (dto.postId !== undefined) {
      if (!isOwner) {
        throw new ForbiddenException(
          'Переносить задачу в другой пост может только владелец'
        );
      }

      if (dto.postId === task.postId) {
        throw new BadRequestException('Задача уже привязана к этому посту');
      }

      const targetPost = await this.prisma.post.findUnique({
        where: { id: dto.postId },
        select: { id: true, ownerId: true, isArchived: true },
      });

      if (!targetPost) {
        throw new NotFoundException('Пост не найден');
      }

      if (targetPost.ownerId !== user.userId) {
        throw new ForbiddenException(
          'Можно перенести задачу только в свой пост'
        );
      }

      if (targetPost.isArchived) {
        throw new BadRequestException(
          'Нельзя перенести задачу в архивный пост'
        );
      }
    }

    const data = this.buildUpdateData(dto, isOwner);
    const changes = this.collectTaskChanges(task, dto, isOwner);
    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );

    if (isOwner && dto.executorId !== undefined) {
      await this.validateExecutor(dto.executorId, task.ownerId);
    }

    const updated = await this.prisma.$transaction(async tx => {
      const updatedTask = await tx.task.update({
        where: { id },
        data,
        include: taskWithMediaInclude,
      });

      if (dto.postId !== undefined && dto.postId !== task.postId) {
        await tx.publication.updateMany({
          where: { taskId: id },
          data: { postId: dto.postId },
        });
      }

      for (const change of changes) {
        await this.logActivity(
          id,
          user.userId,
          change.type,
          change.payload,
          tx,
          actor
        );
      }

      return updatedTask;
    });

    await this.dispatchTaskUpdateNotifications(
      task,
      updated,
      user.userId,
      changes,
      actor
    );
    await this.dispatchPublicationOnCompleted(updated, user.userId, changes);

    return this.toResponse(updated);
  }

  async requestAnnulment(
    user: AuthUser,
    id: string,
    dto: RequestTaskAnnulmentDto
  ): Promise<TaskResponseDto> {
    const task = await this.getTaskOrThrow(id);
    this.assertParticipant(task, user.userId);

    if (!task.executorId) {
      throw new BadRequestException(
        'Аннулирование доступно только для задач с исполнителем'
      );
    }

    if (TERMINAL_TASK_STATUSES.includes(task.status)) {
      throw new BadRequestException(
        'Нельзя аннулировать завершённую или уже аннулированную задачу'
      );
    }

    const pending = await this.prisma.taskAnnulmentRequest.findFirst({
      where: { taskId: id, status: TaskRequestStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException('Запрос на аннулирование уже отправлен');
    }

    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );

    const created = await this.prisma.$transaction(async tx => {
      const request = await tx.taskAnnulmentRequest.create({
        data: {
          taskId: id,
          reason: dto.reason.trim(),
          initiator: dto.initiator as TaskRequestInitiator,
          status: TaskRequestStatus.PENDING,
          requestedById: user.userId,
        },
      });

      await this.logActivity(
        id,
        user.userId,
        TaskActivityType.ANNULMENT_REQUESTED,
        {
          requestId: request.id,
          reason: request.reason,
          initiator: request.initiator,
        },
        tx,
        actor
      );

      return request;
    });

    const updated = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: taskListInclude,
    });

    const recipientId = this.resolveOtherParticipantId(task, user.userId);
    if (recipientId) {
      const taskTitle = updated.title ?? 'Задача';
      await this.notificationsService.notify({
        recipientId,
        actorId: user.userId,
        actor,
        type: NotificationType.TASK_STATUS_CHANGED,
        title: 'Запрос на аннулирование задачи',
        body: `«${taskTitle}»`,
        payload: {
          entityType: 'task',
          entityId: updated.id,
          postId: updated.postId,
          taskId: updated.id,
          meta: {
            taskTitle: updated.title,
            annulmentId: created.id,
            action: 'annulment_requested',
          },
        },
      });
    }

    return this.toResponse(
      updated,
      this.participantResponseOptions(user.userId, updated)
    );
  }

  async confirmAnnulment(
    user: AuthUser,
    id: string
  ): Promise<TaskResponseDto> {
    const task = await this.getTaskOrThrow(id);
    this.assertParticipant(task, user.userId);

    const pending = await this.prisma.taskAnnulmentRequest.findFirst({
      where: { taskId: id, status: TaskRequestStatus.PENDING },
    });
    if (!pending) {
      throw new BadRequestException('Нет активного запроса на аннулирование');
    }

    if (pending.requestedById === user.userId) {
      throw new ForbiddenException(
        'Подтвердить аннулирование может только вторая сторона'
      );
    }

    const previousStatus = task.status;
    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );
    const now = new Date();

    const updated = await this.prisma.$transaction(async tx => {
      await tx.taskAnnulmentRequest.update({
        where: { id: pending.id },
        data: {
          status: TaskRequestStatus.CONFIRMED,
          confirmedAt: now,
          confirmedById: user.userId,
        },
      });

      const updatedTask = await tx.task.update({
        where: { id },
        data: { status: TaskStatus.ANNULLED },
        include: taskListInclude,
      });

      await this.logActivity(
        id,
        user.userId,
        TaskActivityType.ANNULMENT_CONFIRMED,
        {
          requestId: pending.id,
          reason: pending.reason,
          initiator: pending.initiator,
        },
        tx,
        actor
      );

      await this.logActivity(
        id,
        user.userId,
        TaskActivityType.STATUS_CHANGED,
        {
          field: 'status',
          from: previousStatus,
          to: TaskStatus.ANNULLED,
        },
        tx,
        actor
      );

      return updatedTask;
    });

    const recipientId = this.resolveOtherParticipantId(task, user.userId);
    if (recipientId) {
      const taskTitle = updated.title ?? 'Задача';
      await this.notificationsService.notify({
        recipientId,
        actorId: user.userId,
        actor,
        type: NotificationType.TASK_STATUS_CHANGED,
        title: `Статус задачи: ${formatTaskStatus(TaskStatus.ANNULLED)}`,
        body: `«${taskTitle}»`,
        payload: {
          entityType: 'task',
          entityId: updated.id,
          postId: updated.postId,
          taskId: updated.id,
          meta: {
            taskTitle: updated.title,
            from: previousStatus,
            to: TaskStatus.ANNULLED,
            annulmentId: pending.id,
          },
        },
      });
    }

    return this.toResponse(
      updated,
      this.participantResponseOptions(user.userId, updated)
    );
  }

  async rejectAnnulment(
    user: AuthUser,
    id: string
  ): Promise<TaskResponseDto> {
    const task = await this.getTaskOrThrow(id);
    this.assertParticipant(task, user.userId);

    const pending = await this.prisma.taskAnnulmentRequest.findFirst({
      where: { taskId: id, status: TaskRequestStatus.PENDING },
    });
    if (!pending) {
      throw new BadRequestException('Нет активного запроса на аннулирование');
    }

    if (pending.requestedById === user.userId) {
      throw new ForbiddenException(
        'Отклонить аннулирование может только вторая сторона'
      );
    }

    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );
    const now = new Date();

    await this.prisma.$transaction(async tx => {
      await tx.taskAnnulmentRequest.update({
        where: { id: pending.id },
        data: {
          status: TaskRequestStatus.REJECTED,
          confirmedAt: now,
          confirmedById: user.userId,
        },
      });

      await this.logActivity(
        id,
        user.userId,
        TaskActivityType.ANNULMENT_REJECTED,
        {
          requestId: pending.id,
          reason: pending.reason,
          initiator: pending.initiator,
        },
        tx,
        actor
      );
    });

    const updated = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: taskListInclude,
    });

    const recipientId = this.resolveOtherParticipantId(task, user.userId);
    if (recipientId) {
      const taskTitle = updated.title ?? 'Задача';
      await this.notificationsService.notify({
        recipientId,
        actorId: user.userId,
        actor,
        type: NotificationType.TASK_STATUS_CHANGED,
        title: 'Запрос на аннулирование отклонён',
        body: `«${taskTitle}»`,
        payload: {
          entityType: 'task',
          entityId: updated.id,
          postId: updated.postId,
          taskId: updated.id,
          meta: {
            taskTitle: updated.title,
            annulmentId: pending.id,
            action: 'annulment_rejected',
          },
        },
      });
    }

    return this.toResponse(
      updated,
      this.participantResponseOptions(user.userId, updated)
    );
  }

  async requestDeadlineExtension(
    user: AuthUser,
    id: string,
    dto: RequestTaskDeadlineExtensionDto
  ): Promise<TaskResponseDto> {
    const task = await this.getTaskOrThrow(id);
    this.assertParticipant(task, user.userId);

    if (!task.executorId) {
      throw new BadRequestException(
        'Перенос дедлайна доступен только для задач с исполнителем'
      );
    }

    if (TERMINAL_TASK_STATUSES.includes(task.status)) {
      throw new BadRequestException(
        'Нельзя перенести дедлайн завершённой или аннулированной задачи'
      );
    }

    const pending = await this.prisma.taskDeadlineExtensionRequest.findFirst({
      where: { taskId: id, status: TaskRequestStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException('Запрос на перенос дедлайна уже отправлен');
    }

    const proposedFinalDate = new Date(dto.proposedFinalDate);
    if (Number.isNaN(proposedFinalDate.getTime())) {
      throw new BadRequestException('Некорректная предлагаемая дата');
    }

    if (task.finalDate && proposedFinalDate.getTime() <= task.finalDate.getTime()) {
      throw new BadRequestException(
        'Новая дата должна быть позже текущего дедлайна'
      );
    }

    if (!task.finalDate && proposedFinalDate.getTime() <= Date.now()) {
      throw new BadRequestException('Новая дата должна быть в будущем');
    }

    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );

    const created = await this.prisma.$transaction(async tx => {
      const request = await tx.taskDeadlineExtensionRequest.create({
        data: {
          taskId: id,
          reason: dto.reason.trim(),
          initiator: dto.initiator as TaskRequestInitiator,
          status: TaskRequestStatus.PENDING,
          proposedFinalDate,
          requestedById: user.userId,
        },
      });

      await this.logActivity(
        id,
        user.userId,
        TaskActivityType.DEADLINE_EXTENSION_REQUESTED,
        {
          requestId: request.id,
          reason: request.reason,
          initiator: request.initiator,
          proposedFinalDate: request.proposedFinalDate.toISOString(),
        },
        tx,
        actor
      );

      return request;
    });

    const updated = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: taskListInclude,
    });

    const recipientId = this.resolveOtherParticipantId(task, user.userId);
    if (recipientId) {
      const taskTitle = updated.title ?? 'Задача';
      await this.notificationsService.notify({
        recipientId,
        actorId: user.userId,
        actor,
        type: NotificationType.TASK_STATUS_CHANGED,
        title: 'Запрос на перенос дедлайна',
        body: `«${taskTitle}»`,
        payload: {
          entityType: 'task',
          entityId: updated.id,
          postId: updated.postId,
          taskId: updated.id,
          meta: {
            taskTitle: updated.title,
            deadlineExtensionId: created.id,
            action: 'deadline_extension_requested',
            proposedFinalDate: created.proposedFinalDate.toISOString(),
          },
        },
      });
    }

    return this.toResponse(
      updated,
      this.participantResponseOptions(user.userId, updated)
    );
  }

  async confirmDeadlineExtension(
    user: AuthUser,
    id: string
  ): Promise<TaskResponseDto> {
    const task = await this.getTaskOrThrow(id);
    this.assertParticipant(task, user.userId);

    const pending = await this.prisma.taskDeadlineExtensionRequest.findFirst({
      where: { taskId: id, status: TaskRequestStatus.PENDING },
    });
    if (!pending) {
      throw new BadRequestException('Нет активного запроса на перенос дедлайна');
    }

    if (pending.requestedById === user.userId) {
      throw new ForbiddenException(
        'Подтвердить перенос дедлайна может только вторая сторона'
      );
    }

    const previousFinalDate = task.finalDate?.toISOString() ?? null;
    const nextFinalDate = pending.proposedFinalDate;
    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );
    const now = new Date();

    const updated = await this.prisma.$transaction(async tx => {
      await tx.taskDeadlineExtensionRequest.update({
        where: { id: pending.id },
        data: {
          status: TaskRequestStatus.CONFIRMED,
          confirmedAt: now,
          confirmedById: user.userId,
        },
      });

      const updatedTask = await tx.task.update({
        where: { id },
        data: { finalDate: nextFinalDate },
        include: taskListInclude,
      });

      await this.logActivity(
        id,
        user.userId,
        TaskActivityType.DEADLINE_EXTENSION_CONFIRMED,
        {
          requestId: pending.id,
          reason: pending.reason,
          initiator: pending.initiator,
          proposedFinalDate: nextFinalDate.toISOString(),
          from: previousFinalDate,
          to: nextFinalDate.toISOString(),
        },
        tx,
        actor
      );

      await this.logActivity(
        id,
        user.userId,
        TaskActivityType.FIELD_UPDATED,
        {
          field: 'finalDate',
          from: previousFinalDate,
          to: nextFinalDate.toISOString(),
        },
        tx,
        actor
      );

      return updatedTask;
    });

    const recipientId = this.resolveOtherParticipantId(task, user.userId);
    if (recipientId) {
      const taskTitle = updated.title ?? 'Задача';
      await this.notificationsService.notify({
        recipientId,
        actorId: user.userId,
        actor,
        type: NotificationType.TASK_STATUS_CHANGED,
        title: 'Дедлайн перенесён',
        body: `«${taskTitle}»`,
        payload: {
          entityType: 'task',
          entityId: updated.id,
          postId: updated.postId,
          taskId: updated.id,
          meta: {
            taskTitle: updated.title,
            deadlineExtensionId: pending.id,
            action: 'deadline_extension_confirmed',
            from: previousFinalDate,
            to: nextFinalDate.toISOString(),
          },
        },
      });
    }

    return this.toResponse(
      updated,
      this.participantResponseOptions(user.userId, updated)
    );
  }

  async rejectDeadlineExtension(
    user: AuthUser,
    id: string
  ): Promise<TaskResponseDto> {
    const task = await this.getTaskOrThrow(id);
    this.assertParticipant(task, user.userId);

    const pending = await this.prisma.taskDeadlineExtensionRequest.findFirst({
      where: { taskId: id, status: TaskRequestStatus.PENDING },
    });
    if (!pending) {
      throw new BadRequestException('Нет активного запроса на перенос дедлайна');
    }

    if (pending.requestedById === user.userId) {
      throw new ForbiddenException(
        'Отклонить перенос дедлайна может только вторая сторона'
      );
    }

    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );
    const now = new Date();

    await this.prisma.$transaction(async tx => {
      await tx.taskDeadlineExtensionRequest.update({
        where: { id: pending.id },
        data: {
          status: TaskRequestStatus.REJECTED,
          confirmedAt: now,
          confirmedById: user.userId,
        },
      });

      await this.logActivity(
        id,
        user.userId,
        TaskActivityType.DEADLINE_EXTENSION_REJECTED,
        {
          requestId: pending.id,
          reason: pending.reason,
          initiator: pending.initiator,
          proposedFinalDate: pending.proposedFinalDate.toISOString(),
        },
        tx,
        actor
      );
    });

    const updated = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: taskListInclude,
    });

    const recipientId = this.resolveOtherParticipantId(task, user.userId);
    if (recipientId) {
      const taskTitle = updated.title ?? 'Задача';
      await this.notificationsService.notify({
        recipientId,
        actorId: user.userId,
        actor,
        type: NotificationType.TASK_STATUS_CHANGED,
        title: 'Запрос на перенос дедлайна отклонён',
        body: `«${taskTitle}»`,
        payload: {
          entityType: 'task',
          entityId: updated.id,
          postId: updated.postId,
          taskId: updated.id,
          meta: {
            taskTitle: updated.title,
            deadlineExtensionId: pending.id,
            action: 'deadline_extension_rejected',
          },
        },
      });
    }

    return this.toResponse(
      updated,
      this.participantResponseOptions(user.userId, updated)
    );
  }

  private async dispatchPublicationOnCompleted(
    task: Task,
    actorId: string,
    changes: TaskChange[]
  ): Promise<void> {
    const completed = changes.some(change => {
      if (change.type !== TaskActivityType.STATUS_CHANGED) {
        return false;
      }

      const payload = change.payload as { to?: TaskStatus };
      return payload.to === TaskStatus.COMPLETED;
    });

    if (!completed) {
      return;
    }

    await this.publicationsService.createFromCompletedTask(task.id, actorId);
  }

  private async dispatchTaskUpdateNotifications(
    previous: Task,
    updated: Task,
    actorId: string,
    changes: TaskChange[],
    actor?: ActorSnapshot | null
  ): Promise<void> {
    const recipientId = this.resolveOtherParticipantId(previous, actorId);

    if (!recipientId) {
      return;
    }

    const taskTitle = updated.title ?? 'Задача';

    for (const change of changes) {
      if (change.type === TaskActivityType.STATUS_CHANGED) {
        const payload = change.payload as {
          from: TaskStatus;
          to: TaskStatus;
        };

        await this.notificationsService.notify({
          recipientId,
          actorId,
          actor,
          type: NotificationType.TASK_STATUS_CHANGED,
          title: `Статус задачи: ${formatTaskStatus(payload.to)}`,
          body: `«${taskTitle}»`,
          payload: {
            entityType: 'task',
            entityId: updated.id,
            postId: updated.postId,
            taskId: updated.id,
            meta: {
              taskTitle: updated.title,
              from: payload.from,
              to: payload.to,
            },
          },
        });
      }

      if (
        change.type === TaskActivityType.FIELD_UPDATED &&
        (change.payload as { field?: string }).field === 'executorId'
      ) {
        const payload = change.payload as {
          from: string | null;
          to: string | null;
        };

        if (payload.to && payload.to !== actorId) {
          await this.notificationsService.notify({
            recipientId: payload.to,
            actorId,
            actor,
            type: NotificationType.TASK_EXECUTOR_ASSIGNED,
            title: `Вас назначили исполнителем`,
            body: `«${taskTitle}»`,
            payload: {
              entityType: 'task',
              entityId: updated.id,
              postId: updated.postId,
              taskId: updated.id,
              meta: { taskTitle: updated.title },
            },
          });
        }
      }
    }
  }

  private resolveOtherParticipantId(
    task: { ownerId: string; executorId: string | null },
    actorId: string
  ): string | null {
    if (task.ownerId === actorId) {
      return task.executorId;
    }

    if (task.executorId === actorId) {
      return task.ownerId;
    }

    return null;
  }

  async assertParticipantForMedia(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { ownerId: true, executorId: true },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    if (task.ownerId !== userId && task.executorId !== userId) {
      throw new ForbiddenException(
        'Недостаточно прав для загрузки в эту задачу'
      );
    }

    return task;
  }

  async listMediaForCopy(
    userId: string,
    taskId: string,
    options: {
      kind?: TaskMediaKind;
      mediaIds?: string[];
    } = {}
  ) {
    await this.assertParticipantForMedia(userId, taskId);

    const kind = options.kind ?? TaskMediaKind.MAIN;
    const mediaIds = options.mediaIds?.filter(Boolean);

    const items = await this.prisma.taskMedia.findMany({
      where: {
        taskId,
        kind,
        ...(mediaIds?.length ? { id: { in: mediaIds } } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        url: true,
        key: true,
        size: true,
        mimeType: true,
      },
    });

    if (mediaIds?.length && items.length !== mediaIds.length) {
      throw new NotFoundException('Некоторые медиа задачи не найдены');
    }

    return items;
  }

  async addMedia(
    taskId: string,
    actorId: string,
    data: { url: string; key: string; size: string; mimeType: string },
    kind: TaskMediaKind = TaskMediaKind.MAIN,
    accountId?: string
  ) {
    const count = await this.prisma.taskMedia.count({
      where: { taskId, kind },
    });

    const actor = accountId
      ? await this.actorAttribution.resolve(accountId, actorId)
      : null;

    const media = await this.prisma.taskMedia.create({
      data: {
        taskId,
        kind,
        url: data.url,
        key: data.key,
        size: data.size,
        mimeType: data.mimeType,
        sortOrder: count,
      },
    });

    await this.logActivity(
      taskId,
      actorId,
      TaskActivityType.MEDIA_ADDED,
      {
        mediaId: media.id,
        kind: media.kind,
        url: media.url,
        key: media.key,
        mimeType: media.mimeType,
        size: media.size,
      },
      undefined,
      actor
    );

    if (kind === TaskMediaKind.REPORT) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, ownerId: true, postId: true, title: true },
      });

      if (task && task.ownerId !== actorId) {
        await this.notificationsService.notify({
          recipientId: task.ownerId,
          actorId,
          actor,
          type: NotificationType.TASK_MEDIA_ADDED,
          title: 'Исполнитель загрузил отчёт',
          body: task.title ? `«${task.title}»` : undefined,
          payload: {
            entityType: 'task',
            entityId: task.id,
            postId: task.postId,
            taskId: task.id,
            meta: { taskTitle: task.title, kind },
          },
        });
      }
    }

    return media;
  }

  async removeMedia(
    userId: string,
    taskId: string,
    mediaId: string,
    accountId?: string
  ): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, userId);

    const media = await this.prisma.taskMedia.findFirst({
      where: { id: mediaId, taskId },
    });

    if (!media) {
      throw new NotFoundException('Медиа не найдено');
    }

    try {
      await this.storageService.deleteObject(media.key);
    } catch {
      throw new InternalServerErrorException('Не удалось удалить файл');
    }

    const actor = accountId
      ? await this.actorAttribution.resolve(accountId, userId)
      : null;

    await this.prisma.$transaction(async tx => {
      await tx.taskMedia.delete({
        where: { id: mediaId },
      });

      await this.logActivity(
        taskId,
        userId,
        TaskActivityType.MEDIA_REMOVED,
        {
          mediaId: media.id,
          kind: media.kind,
          url: media.url,
          key: media.key,
          mimeType: media.mimeType,
          size: media.size,
        },
        tx,
        actor
      );
    });
  }

  async listActivities(
    user: AuthUser,
    taskId: string,
    query: ListTaskActivitiesQueryDto
  ) {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      taskId,
      ...(query.type !== undefined && { type: query.type }),
    };

    const [items, total] = await Promise.all([
      this.prisma.taskActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.taskActivity.count({ where }),
    ]);

    return {
      items: items.map(activity => this.toActivityResponse(activity)),
      total,
      page,
      limit,
    };
  }

  async listAllActivities(
    user: AuthUser,
    query: ListAllTaskActivitiesQueryDto
  ) {
    if (query.taskId !== undefined) {
      const task = await this.getTaskOrThrow(query.taskId);
      this.assertParticipant(task, user.userId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskActivityWhereInput = {
      ...(query.taskId !== undefined
        ? { taskId: query.taskId }
        : { task: this.buildParticipantTaskWhere(user.userId, query.role) }),
      ...(query.type !== undefined && { type: query.type }),
    };

    const [items, total] = await Promise.all([
      this.prisma.taskActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.taskActivity.count({ where }),
    ]);

    return {
      items: items.map(activity => this.toActivityResponse(activity)),
      total,
      page,
      limit,
    };
  }

  async listAllComments(user: AuthUser, query: ListAllTaskCommentsQueryDto) {
    if (query.taskId !== undefined) {
      const task = await this.getTaskOrThrow(query.taskId);
      this.assertParticipant(task, user.userId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskCommentWhereInput = {
      ...(query.taskId !== undefined
        ? { taskId: query.taskId }
        : { task: this.buildParticipantTaskWhere(user.userId, query.role) }),
      ...(query.q !== undefined && {
        content: { contains: query.q, mode: 'insensitive' },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.taskComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: commentWithMediaInclude,
      }),
      this.prisma.taskComment.count({ where }),
    ]);

    const mapped = await this.mapCommentsWithReadState(user.userId, items);

    return {
      items: mapped,
      total,
      page,
      limit,
    };
  }

  async listTasksWithComments(
    user: AuthUser,
    query: ListTasksWithCommentsQueryDto
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildTasksWithCommentsWhere(user.userId, query);

    const groups = await this.prisma.taskComment.groupBy({
      by: ['taskId'],
      where,
      _count: { _all: true },
      _max: { createdAt: true },
    });

    const sortedGroups = groups
      .map(group => ({
        taskId: group.taskId,
        commentsCount: group._count._all,
        lastCommentAt: group._max.createdAt ?? new Date(0),
      }))
      .sort(
        (left, right) =>
          right.lastCommentAt.getTime() - left.lastCommentAt.getTime()
      );

    const total = sortedGroups.length;
    const pageGroups = sortedGroups.slice(skip, skip + limit);

    if (pageGroups.length === 0) {
      return { items: [], total, page, limit };
    }

    const taskIds = pageGroups.map(group => group.taskId);

    const participantSelect = {
      id: true,
      role: true,
      avatar: true,
      creatorProfile: { select: { name: true, lastName: true } },
      companyProfile: { select: { companyName: true } },
    } as const;

    const [tasks, lastComments] = await Promise.all([
      this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: {
          id: true,
          title: true,
          ownerId: true,
          executorId: true,
          post: { select: { title: true } },
          owner: { select: participantSelect },
          executor: { select: participantSelect },
        },
      }),
      this.prisma.taskComment.findMany({
        where: { taskId: { in: taskIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['taskId'],
        select: {
          taskId: true,
          content: true,
          createdAt: true,
          authorId: true,
          _count: { select: { media: true } },
        },
      }),
    ]);

    const unreadByTaskId = await this.countUnreadCommentsByTask(
      user.userId,
      taskIds
    );

    const tasksById = new Map(tasks.map(task => [task.id, task]));
    const lastCommentsByTaskId = new Map(
      lastComments.map(comment => [comment.taskId, comment])
    );

    const items: TaskWithCommentsSummaryDto[] = [];

    for (const group of pageGroups) {
      const task = tasksById.get(group.taskId);
      const lastComment = lastCommentsByTaskId.get(group.taskId);

      if (!task || !lastComment) {
        continue;
      }

      const recipientUser =
        task.ownerId === user.userId
          ? task.executor
          : task.executorId === user.userId
            ? task.owner
            : null;

      items.push({
        taskId: group.taskId,
        title: resolveTaskTitle(task.title, task.post.title),
        recipient: recipientUser
          ? this.mapCommentsRecipient(recipientUser)
          : null,
        lastComment: {
          preview: buildCommentPreview(
            lastComment.content,
            lastComment._count.media > 0
          ),
          createdAt: lastComment.createdAt.toISOString(),
          authorId: lastComment.authorId,
        },
        commentsCount: group.commentsCount,
        unreadCount: unreadByTaskId.get(group.taskId) ?? 0,
      });
    }

    return { items, total, page, limit };
  }

  async listComments(
    user: AuthUser,
    taskId: string,
    query: ListTaskCommentsQueryDto
  ) {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const shouldMarkRead = query.markRead ?? true;

    let readState = await this.getTaskCommentReadState(task, user.userId);

    if (shouldMarkRead) {
      const readAt = await this.markTaskCommentsAsRead(taskId, user.userId);
      readState = { ...readState, viewerLastReadAt: readAt };
    }

    const where = { taskId };

    const [items, total] = await Promise.all([
      this.prisma.taskComment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: commentWithMediaInclude,
      }),
      this.prisma.taskComment.count({ where }),
    ]);

    return {
      items: items.map(comment =>
        this.toCommentResponse(
          comment,
          user.userId,
          readState.viewerLastReadAt,
          readState.peerLastReadAt
        )
      ),
      total,
      page,
      limit,
    };
  }

  async markTaskCommentsAsRead(taskId: string, userId: string): Promise<Date> {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, userId);

    const latestComment = await this.prisma.taskComment.findFirst({
      where: { taskId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true },
    });

    const readAt = latestComment?.createdAt ?? new Date();

    await this.prisma.taskCommentReadState.upsert({
      where: {
        taskId_userId: { taskId, userId },
      },
      create: {
        taskId,
        userId,
        lastReadAt: readAt,
      },
      update: {
        lastReadAt: readAt,
      },
    });

    this.taskCommentsGateway.broadcastCommentsRead(taskId, {
      taskId,
      userId,
      readAt: readAt.toISOString(),
    });

    return readAt;
  }

  async searchComments(
    user: AuthUser,
    taskId: string,
    query: SearchTaskCommentsQueryDto
  ) {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const readState = await this.getTaskCommentReadState(task, user.userId);

    const where: Prisma.TaskCommentWhereInput = {
      taskId,
      content: { contains: query.q, mode: 'insensitive' },
    };

    const [items, total] = await Promise.all([
      this.prisma.taskComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: commentWithMediaInclude,
      }),
      this.prisma.taskComment.count({ where }),
    ]);

    return {
      items: items.map(comment =>
        this.toCommentResponse(
          comment,
          user.userId,
          readState.viewerLastReadAt,
          readState.peerLastReadAt
        )
      ),
      total,
      page,
      limit,
    };
  }

  async listCommentAttachments(
    user: AuthUser,
    taskId: string,
    query: ListTaskCommentAttachmentsQueryDto
  ) {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskCommentMediaWhereInput = {
      comment: { taskId },
      ...(query.type === TaskCommentAttachmentTypeFilter.IMAGE && {
        mimeType: { startsWith: 'image/' },
      }),
      ...(query.type === TaskCommentAttachmentTypeFilter.VIDEO && {
        mimeType: { startsWith: 'video/' },
      }),
      ...(query.type === TaskCommentAttachmentTypeFilter.DOCUMENT && {
        mimeType: { in: [...ALLOWED_DOCUMENT_MIME_TYPES] },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.taskCommentMedia.findMany({
        where,
        orderBy: [{ comment: { createdAt: 'desc' } }, { sortOrder: 'asc' }],
        skip,
        take: limit,
        include: {
          comment: {
            select: {
              id: true,
              authorId: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.taskCommentMedia.count({ where }),
    ]);

    return {
      items: items.map(attachment =>
        this.toCommentAttachmentResponse(attachment)
      ),
      total,
      page,
      limit,
    };
  }

  async listAttachments(
    user: AuthUser,
    taskId: string,
    query: ListTaskAttachmentsQueryDto
  ) {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskMediaWhereInput = {
      taskId,
      ...(query.kind === TaskAttachmentKindFilter.MAIN && {
        kind: TaskMediaKind.MAIN,
      }),
      ...(query.kind === TaskAttachmentKindFilter.REPORT && {
        kind: TaskMediaKind.REPORT,
      }),
      ...(query.type === TaskAttachmentTypeFilter.IMAGE && {
        mimeType: { startsWith: 'image/' },
      }),
      ...(query.type === TaskAttachmentTypeFilter.VIDEO && {
        mimeType: { startsWith: 'video/' },
      }),
      ...(query.type === TaskAttachmentTypeFilter.DOCUMENT && {
        mimeType: { in: [...ALLOWED_DOCUMENT_MIME_TYPES] },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.taskMedia.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { sortOrder: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.taskMedia.count({ where }),
    ]);

    return {
      items: items.map(attachment => this.toTaskAttachmentResponse(attachment)),
      total,
      page,
      limit,
    };
  }

  async createComment(
    user: AuthUser,
    taskId: string,
    dto: CreateTaskCommentDto
  ): Promise<TaskCommentResponseDto> {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const content = (dto.content ?? '').trim();
    const media = dto.media ?? [];

    if (!content && media.length === 0) {
      throw new BadRequestException('Комментарий не может быть пустым');
    }

    this.assertCommentMediaKeys(taskId, media);

    const actor = await this.actorAttribution.resolve(
      user.accountId,
      user.userId
    );

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId: user.userId,
        content,
        ...this.actorAttribution.toPrismaFields(actor),
        ...(media.length > 0 && {
          media: {
            create: media.map((item, index) => ({
              url: item.url,
              key: item.key,
              size: item.size,
              mimeType: item.mimeType,
              sortOrder: index,
            })),
          },
        }),
      },
      include: commentWithMediaInclude,
    });

    await this.prisma.task.update({
      where: { id: taskId },
      data: { updatedAt: comment.createdAt },
    });

    const recipientId = this.resolveOtherParticipantId(task, user.userId);

    if (recipientId) {
      const preview =
        content.length > 0
          ? content.slice(0, 200)
          : media.length > 0
            ? '[медиа]'
            : '';

      await this.notificationsService.notify({
        recipientId,
        actorId: user.userId,
        actor,
        type: NotificationType.TASK_COMMENT_CREATED,
        title: 'Новый комментарий к задаче',
        body: preview,
        payload: {
          entityType: 'task',
          entityId: taskId,
          postId: task.postId,
          taskId,
          meta: {
            commentId: comment.id,
            preview,
          },
        },
      });
    }

    const readState = await this.getTaskCommentReadState(task, user.userId);
    const response = this.toCommentResponse(
      comment,
      user.userId,
      readState.viewerLastReadAt,
      readState.peerLastReadAt
    );

    this.taskCommentsGateway.broadcastComment(taskId, response);

    return response;
  }

  async updateComment(
    user: AuthUser,
    taskId: string,
    commentId: string,
    dto: UpdateTaskCommentDto
  ): Promise<TaskCommentResponseDto> {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const comment = await this.getCommentOrThrow(taskId, commentId, {
      includeMedia: true,
    });
    this.assertCanModifyComment(task, comment.authorId, user.userId);

    const trimmedContent = dto.content.trim();

    if (!trimmedContent && comment.media.length === 0) {
      throw new BadRequestException('Комментарий не может быть пустым');
    }

    const readState = await this.getTaskCommentReadState(task, user.userId);

    if (trimmedContent === comment.content.trim()) {
      return this.toCommentResponse(
        comment,
        user.userId,
        readState.viewerLastReadAt,
        readState.peerLastReadAt
      );
    }

    const editedAt = new Date();

    const updated = await this.prisma.taskComment.update({
      where: { id: commentId },
      data: {
        content: trimmedContent,
        editedAt,
      },
      include: commentWithMediaInclude,
    });

    const response = this.toCommentResponse(
      updated,
      user.userId,
      readState.viewerLastReadAt,
      readState.peerLastReadAt
    );

    this.taskCommentsGateway.broadcastCommentEdited(taskId, response);

    return response;
  }

  async deleteComment(
    user: AuthUser,
    taskId: string,
    commentId: string
  ): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const comment = await this.getCommentOrThrow(taskId, commentId, {
      includeMedia: true,
    });
    this.assertCanModifyComment(task, comment.authorId, user.userId);

    for (const item of comment.media) {
      try {
        await this.storageService.deleteObject(item.key);
      } catch {
        throw new InternalServerErrorException('Не удалось удалить файл');
      }
    }

    await this.prisma.taskComment.delete({
      where: { id: commentId },
    });

    this.taskCommentsGateway.broadcastCommentDeleted(taskId, {
      taskId,
      commentId,
    });
  }

  async assertTaskParticipant(taskId: string, userId: string): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, userId);
  }

  private async logActivity(
    taskId: string,
    actorId: string,
    type: TaskActivityType,
    payload: Prisma.InputJsonValue,
    tx?: PrismaTx,
    actor?: ActorSnapshot | null
  ) {
    const client = tx ?? this.prisma;

    return client.taskActivity.create({
      data: {
        taskId,
        actorId,
        type,
        payload,
        ...this.actorAttribution.toPrismaFields(actor),
      },
    });
  }

  private collectTaskChanges(
    task: Task,
    dto: UpdateTaskDto,
    isOwner: boolean
  ): TaskChange[] {
    const changes: TaskChange[] = [];

    if (dto.status !== undefined && dto.status !== task.status) {
      changes.push({
        type: TaskActivityType.STATUS_CHANGED,
        payload: {
          field: 'status',
          from: task.status,
          to: dto.status,
        },
      });
    }

    if (!isOwner) {
      if (
        dto.isExecutorApprove !== undefined &&
        dto.isExecutorApprove !== task.isExecutorApprove
      ) {
        changes.push({
          type: TaskActivityType.FIELD_UPDATED,
          payload: {
            field: 'isExecutorApprove',
            from: task.isExecutorApprove,
            to: dto.isExecutorApprove,
          },
        });
      }

      return changes;
    }

    if (dto.description !== undefined && dto.description !== task.description) {
      changes.push({
        type: TaskActivityType.FIELD_UPDATED,
        payload: {
          field: 'description',
          from: task.description,
          to: dto.description,
        },
      });
    }

    if (dto.title !== undefined && dto.title !== task.title) {
      changes.push({
        type: TaskActivityType.FIELD_UPDATED,
        payload: {
          field: 'title',
          from: task.title,
          to: dto.title,
        },
      });
    }

    if (dto.finalDate !== undefined) {
      const nextFinalDate =
        dto.finalDate === null ? null : new Date(dto.finalDate).toISOString();
      const currentFinalDate = task.finalDate?.toISOString() ?? null;

      if (nextFinalDate !== currentFinalDate) {
        changes.push({
          type: TaskActivityType.FIELD_UPDATED,
          payload: {
            field: 'finalDate',
            from: currentFinalDate,
            to: nextFinalDate,
          },
        });
      }
    }

    if (dto.photoCount !== undefined && dto.photoCount !== task.photoCount) {
      changes.push({
        type: TaskActivityType.FIELD_UPDATED,
        payload: {
          field: 'photoCount',
          from: task.photoCount,
          to: dto.photoCount,
        },
      });
    }

    if (dto.videoCount !== undefined && dto.videoCount !== task.videoCount) {
      changes.push({
        type: TaskActivityType.FIELD_UPDATED,
        payload: {
          field: 'videoCount',
          from: task.videoCount,
          to: dto.videoCount,
        },
      });
    }

    if (dto.urgent !== undefined && dto.urgent !== task.urgent) {
      changes.push({
        type: TaskActivityType.FIELD_UPDATED,
        payload: {
          field: 'urgent',
          from: task.urgent,
          to: dto.urgent,
        },
      });
    }

    if (dto.executorId !== undefined && dto.executorId !== task.executorId) {
      changes.push({
        type: TaskActivityType.FIELD_UPDATED,
        payload: {
          field: 'executorId',
          from: task.executorId,
          to: dto.executorId,
        },
      });
    }

    if (dto.postId !== undefined && dto.postId !== task.postId) {
      changes.push({
        type: TaskActivityType.FIELD_UPDATED,
        payload: {
          field: 'postId',
          from: task.postId,
          to: dto.postId,
        },
      });
    }

    for (const field of ['location', 'brief', 'deliverables'] as const) {
      if (
        dto[field] !== undefined &&
        this.jsonFieldChanged(task[field], dto[field])
      ) {
        changes.push({
          type: TaskActivityType.FIELD_UPDATED,
          payload: {
            field,
            from: task[field] ?? null,
            to: (dto[field] ?? null) as Prisma.InputJsonValue,
          },
        });
      }
    }

    if (dto.bloggerRequirements !== undefined) {
      const current = columnsToBloggerRequirements(task);
      if (this.jsonFieldChanged(current, dto.bloggerRequirements)) {
        changes.push({
          type: TaskActivityType.FIELD_UPDATED,
          payload: {
            field: 'bloggerRequirements',
            from: current as Prisma.InputJsonValue,
            to: (dto.bloggerRequirements ??
              null) as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    if (dto.cooperationDetails !== undefined) {
      const current = columnsToCooperationDetails(task);
      if (this.jsonFieldChanged(current, dto.cooperationDetails)) {
        changes.push({
          type: TaskActivityType.FIELD_UPDATED,
          payload: {
            field: 'cooperationDetails',
            from: current as Prisma.InputJsonValue,
            to: (dto.cooperationDetails ??
              null) as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    if (
      dto.isExecutorApprove !== undefined &&
      dto.isExecutorApprove !== task.isExecutorApprove
    ) {
      changes.push({
        type: TaskActivityType.FIELD_UPDATED,
        payload: {
          field: 'isExecutorApprove',
          from: task.isExecutorApprove,
          to: dto.isExecutorApprove,
        },
      });
    }

    return changes;
  }

  private buildUpdateData(
    dto: UpdateTaskDto,
    isOwner: boolean
  ): Prisma.TaskUpdateInput {
    if (!isOwner) {
      if (
        dto.status === undefined &&
        dto.isExecutorApprove === undefined &&
        dto.isCompanyAction === undefined
      ) {
        throw new ForbiddenException(
          'Исполнитель может изменять только статус задачи, одобрение и isCompanyAction'
        );
      }

      const ownerOnlyFields: (keyof UpdateTaskDto)[] = [
        'title',
        'description',
        'finalDate',
        'photoCount',
        'videoCount',
        'urgent',
        'executorId',
        'postId',
        'location',
        'bloggerRequirements',
        'cooperationDetails',
        'brief',
        'deliverables',
      ];

      for (const field of ownerOnlyFields) {
        if (dto[field] !== undefined) {
          throw new ForbiddenException(
            'Исполнитель может изменять только статус задачи, одобрение и isCompanyAction'
          );
        }
      }

      const data: Prisma.TaskUpdateInput = {};

      if (dto.status !== undefined) data.status = dto.status;
      if (dto.isExecutorApprove !== undefined) {
        data.isExecutorApprove = dto.isExecutorApprove;
      }
      if (dto.isCompanyAction !== undefined) {
        data.isCompanyAction = dto.isCompanyAction;
      }

      return data;
    }

    const data: Prisma.TaskUpdateInput = {};

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.finalDate !== undefined) {
      data.finalDate = dto.finalDate === null ? null : new Date(dto.finalDate);
    }
    if (dto.photoCount !== undefined) data.photoCount = dto.photoCount;
    if (dto.videoCount !== undefined) data.videoCount = dto.videoCount;
    if (dto.urgent !== undefined) data.urgent = dto.urgent;
    if (dto.isExecutorApprove !== undefined) {
      data.isExecutorApprove = dto.isExecutorApprove;
    }
    if (dto.isCompanyAction !== undefined) {
      data.isCompanyAction = dto.isCompanyAction;
    }
    if (dto.executorId !== undefined) {
      data.executor = { connect: { id: dto.executorId } };
    }
    if (dto.postId !== undefined) {
      data.post = { connect: { id: dto.postId } };
      data.application = { disconnect: true };
    }

    Object.assign(data, taskJsonFieldsFromDto(dto));

    return data;
  }

  private async getTaskOrThrow(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    return task;
  }

  private assertCommentMediaKeys(
    taskId: string,
    media: TaskCommentMediaInputDto[]
  ) {
    const expectedKeyPrefix = `tasks/${taskId}/`;

    for (const item of media) {
      if (!item.key.startsWith(expectedKeyPrefix)) {
        throw new BadRequestException(
          `Недопустимый ключ медиа для этой задачи. Загрузите файл: POST /media/upload?taskId=${taskId}&forComment=true`
        );
      }
    }
  }

  /**
   * При создании задачи принимает свежие uploads ИЛИ медиа чужой задачи того же владельца
   * (дублирование): копирует объекты в S3 под новый taskId.
   */
  private async prepareCreateTaskMedia(
    taskId: string,
    postId: string,
    ownerId: string,
    media: TaskCommentMediaInputDto[]
  ): Promise<
    Array<{
      url: string;
      key: string;
      size: string;
      mimeType: string;
      kind: TaskMediaKind;
    }>
  > {
    const allowedPrefixes = [
      `${ownerId}/`,
      `posts/${postId}/`,
      `tasks/${taskId}/main/`,
      `tasks/${taskId}/reports/`,
      `tasks/${taskId}/`,
    ];

    const prepared: Array<{
      url: string;
      key: string;
      size: string;
      mimeType: string;
      kind: TaskMediaKind;
    }> = [];

    for (const item of media) {
      if (allowedPrefixes.some(prefix => item.key.startsWith(prefix))) {
        prepared.push({
          url: item.url,
          key: item.key,
          size: item.size,
          mimeType: item.mimeType,
          kind: item.key.includes('/reports/')
            ? TaskMediaKind.REPORT
            : TaskMediaKind.MAIN,
        });
        continue;
      }

      const sourceMatch = item.key.match(/^tasks\/([^/]+)\//);
      if (!sourceMatch) {
        throw new BadRequestException(
          'Недопустимый ключ медиа. Загрузите файл через POST /media/upload (без taskId или с postId)'
        );
      }

      const sourceTaskId = sourceMatch[1];
      if (sourceTaskId === taskId) {
        prepared.push({
          url: item.url,
          key: item.key,
          size: item.size,
          mimeType: item.mimeType,
          kind: item.key.includes('/reports/')
            ? TaskMediaKind.REPORT
            : TaskMediaKind.MAIN,
        });
        continue;
      }

      const sourceTask = await this.prisma.task.findFirst({
        where: { id: sourceTaskId, ownerId },
        select: { id: true },
      });

      if (!sourceTask) {
        throw new BadRequestException(
          'Недопустимый ключ медиа. Можно копировать только медиа своих задач'
        );
      }

      const kind = item.key.includes('/reports/')
        ? TaskMediaKind.REPORT
        : TaskMediaKind.MAIN;
      const subPath = kind === TaskMediaKind.REPORT ? 'reports' : 'main';
      const extension =
        item.key.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
        'bin';
      const destKey = `tasks/${taskId}/${subPath}/${randomUUID()}.${extension}`;

      try {
        await this.storageService.copyObject(item.key, destKey, item.mimeType);
      } catch {
        throw new InternalServerErrorException(
          'Не удалось скопировать медиа при создании задачи'
        );
      }

      prepared.push({
        url: this.storageService.getPublicUrl(destKey),
        key: destKey,
        size: item.size,
        mimeType: item.mimeType,
        kind,
      });
    }

    return prepared;
  }

  private async getCommentOrThrow(
    taskId: string,
    commentId: string,
    options: { includeMedia?: boolean } = {}
  ) {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      ...(options.includeMedia && { include: commentWithMediaInclude }),
    });

    if (!comment || comment.taskId !== taskId) {
      throw new NotFoundException('Комментарий не найден');
    }

    return comment;
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

  private async validateExecutor(
    executorId: string,
    ownerId: string
  ): Promise<void> {
    if (executorId === ownerId) {
      throw new BadRequestException(
        'Исполнитель не может совпадать с владельцем поста'
      );
    }

    const executor = await this.prisma.user.findUnique({
      where: { id: executorId },
      select: { id: true },
    });

    if (!executor) {
      throw new NotFoundException('Исполнитель не найден');
    }
  }

  private assertParticipant(
    task: Pick<Task, 'ownerId' | 'executorId'>,
    userId: string
  ) {
    if (
      task.ownerId !== userId &&
      (task.executorId === null || task.executorId !== userId)
    ) {
      throw new ForbiddenException('Нет доступа к этой задаче');
    }
  }

  private assertCanModifyComment(
    task: Pick<Task, 'ownerId'>,
    authorId: string,
    userId: string
  ) {
    if (task.ownerId === userId) {
      return;
    }

    if (authorId !== userId) {
      throw new ForbiddenException(
        'Недостаточно прав для изменения комментария'
      );
    }
  }

  private mapExecutor(
    executor: TaskListItem['executor']
  ): ApplicationApplicantDto {
    const base: ApplicationApplicantDto = {
      id: executor.id,
      role: executor.role,
      avatar: executor.avatar,
    };

    if (executor.role === Role.CREATOR && executor.creatorProfile) {
      return {
        ...base,
        name: executor.creatorProfile.name,
        lastName: executor.creatorProfile.lastName,
      };
    }

    if (executor.role === Role.COMPANY && executor.companyProfile) {
      return {
        ...base,
        companyName: executor.companyProfile.companyName,
      };
    }

    return base;
  }

  private mapTaskMedia(item: {
    id: string;
    url: string;
    key: string;
    size: string;
    mimeType: string;
    kind: TaskMediaKind;
  }) {
    return {
      id: item.id,
      url: item.url,
      key: item.key,
      size: item.size,
      mimeType: item.mimeType,
      kind: item.kind,
    };
  }

  private participantResponseOptions(
    userId: string,
    task: { ownerId: string; executorId: string | null }
  ) {
    const isOwner = task.ownerId === userId;

    return {
      includePost: true,
      includeExecutor: true,
      includeOwner: !isOwner,
    };
  }

  private toResponse(
    task: TaskWithRelations | TaskListItem,
    options: {
      includeExecutor?: boolean;
      includePost?: boolean;
      includeOwner?: boolean;
    } = {}
  ): TaskResponseDto {
    return {
      id: task.id,
      applicationId: task.applicationId ?? null,
      postId: task.postId,
      ownerId: task.ownerId,
      executorId: task.executorId ?? null,
      status: task.status,
      title: task.title ?? null,
      media: task.media
        .filter(item => item.kind === TaskMediaKind.MAIN)
        .map(item => this.mapTaskMedia(item)),
      reportMedia: task.media
        .filter(item => item.kind === TaskMediaKind.REPORT)
        .map(item => this.mapTaskMedia(item)),
      description: task.description,
      finalDate: task.finalDate?.toISOString() ?? null,
      photoCount: task.photoCount,
      videoCount: task.videoCount,
      urgent: task.urgent,
      isExecutorApprove: task.isExecutorApprove ?? null,
      isCompanyAction: task.isCompanyAction,
      location: this.mapTaskLocation(task.location),
      bloggerRequirements: columnsToBloggerRequirements(task),
      cooperationDetails: columnsToCooperationDetails(task),
      brief: this.mapTaskBrief(task.brief),
      deliverables: this.mapTaskDeliverables(task.deliverables),
      ...this.mapTaskRequests(task),
      assigneeAccountId: task.assigneeAccountId ?? null,
      assigneeDisplayName: task.assigneeDisplayName ?? null,
      assigneeKind: task.assigneeKind ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      ...(options.includePost &&
        'post' in task && {
        post: {
          id: task.post.id,
          title: task.post.title,
          type: task.post.type,
          ownerId: task.post.ownerId,
          isPrivate: task.post.isPrivate,
        },
      }),
      ...(options.includeExecutor &&
        'executor' in task &&
        task.executor && {
        executor: this.mapExecutor(task.executor),
      }),
      ...(options.includeOwner &&
        'owner' in task && {
        owner: mapOwnerWithStats(task.owner),
      }),
    };
  }

  private mapTaskRequests(task: {
    annulmentRequests?: Array<{
      id: string;
      reason: string;
      initiator: TaskRequestInitiator;
      status: TaskRequestStatus;
      requestedAt: Date;
      requestedById: string;
      confirmedAt: Date | null;
      confirmedById: string | null;
    }>;
    deadlineExtensionRequests?: Array<{
      id: string;
      reason: string;
      initiator: TaskRequestInitiator;
      status: TaskRequestStatus;
      proposedFinalDate: Date;
      requestedAt: Date;
      requestedById: string;
      confirmedAt: Date | null;
      confirmedById: string | null;
    }>;
  }): {
    annulment: TaskAnnulmentDto | null;
    annulments: TaskAnnulmentDto[];
    deadlineExtension: TaskDeadlineExtensionDto | null;
    deadlineExtensions: TaskDeadlineExtensionDto[];
  } {
    const annulments = (task.annulmentRequests ?? []).map(item =>
      this.mapAnnulmentRequest(item)
    );
    const deadlineExtensions = (task.deadlineExtensionRequests ?? []).map(
      item => this.mapDeadlineExtensionRequest(item)
    );

    return {
      annulments,
      deadlineExtensions,
      annulment:
        annulments.find(item => item.status === TaskAnnulmentStatus.PENDING) ??
        null,
      deadlineExtension:
        deadlineExtensions.find(
          item => item.status === TaskDeadlineExtensionStatus.PENDING
        ) ?? null,
    };
  }

  private mapAnnulmentRequest(item: {
    id: string;
    reason: string;
    initiator: TaskRequestInitiator;
    status: TaskRequestStatus;
    requestedAt: Date;
    requestedById: string;
    confirmedAt: Date | null;
    confirmedById: string | null;
  }): TaskAnnulmentDto {
    return {
      id: item.id,
      reason: item.reason,
      initiator: item.initiator as TaskAnnulmentInitiator,
      requestedAt: item.requestedAt.toISOString(),
      requestedById: item.requestedById,
      status: item.status as TaskAnnulmentStatus,
      confirmedAt: item.confirmedAt?.toISOString() ?? null,
      confirmedById: item.confirmedById,
    };
  }

  private mapDeadlineExtensionRequest(item: {
    id: string;
    reason: string;
    initiator: TaskRequestInitiator;
    status: TaskRequestStatus;
    proposedFinalDate: Date;
    requestedAt: Date;
    requestedById: string;
    confirmedAt: Date | null;
    confirmedById: string | null;
  }): TaskDeadlineExtensionDto {
    return {
      id: item.id,
      reason: item.reason,
      initiator: item.initiator as TaskAnnulmentInitiator,
      proposedFinalDate: item.proposedFinalDate.toISOString(),
      requestedAt: item.requestedAt.toISOString(),
      requestedById: item.requestedById,
      status: item.status as TaskDeadlineExtensionStatus,
      confirmedAt: item.confirmedAt?.toISOString() ?? null,
      confirmedById: item.confirmedById,
    };
  }

  private mapTaskLocation(
    value: Prisma.JsonValue | null
  ): TaskResponseDto['location'] {
    const record = jsonToRecord(value);
    return record ? (record as TaskResponseDto['location']) : null;
  }

  private mapTaskBrief(value: Prisma.JsonValue | null): TaskResponseDto['brief'] {
    const record = jsonToRecord(value);
    return record ? (record as TaskResponseDto['brief']) : null;
  }

  private mapTaskDeliverables(
    value: Prisma.JsonValue | null
  ): TaskResponseDto['deliverables'] {
    const items = jsonToArray(value);
    return items ? (items as unknown as TaskResponseDto['deliverables']) : null;
  }

  private jsonFieldChanged(
    current: unknown,
    next: unknown
  ): boolean {
    return JSON.stringify(current ?? null) !== JSON.stringify(next ?? null);
  }

  private toActivityResponse(activity: {
    id: string;
    taskId: string;
    actorId: string;
    type: TaskActivityType;
    payload: Prisma.JsonValue;
    createdAt: Date;
    actorAccountId?: string | null;
    actorDisplayName?: string | null;
    actorKind?: 'OWNER' | 'MANAGER' | null;
  }): TaskActivityResponseDto {
    return {
      id: activity.id,
      taskId: activity.taskId,
      actorId: activity.actorId,
      type: activity.type,
      payload: activity.payload as Record<string, unknown>,
      createdAt: activity.createdAt.toISOString(),
      actorAccountId: activity.actorAccountId ?? null,
      actorDisplayName: activity.actorDisplayName ?? null,
      actorKind: activity.actorKind ?? null,
    };
  }

  private toTaskAttachmentResponse(attachment: {
    id: string;
    kind: TaskMediaKind;
    url: string;
    key: string;
    size: string;
    mimeType: string;
    createdAt: Date;
  }): TaskAttachmentResponseDto {
    return {
      id: attachment.id,
      kind: attachment.kind,
      url: attachment.url,
      key: attachment.key,
      size: attachment.size,
      mimeType: attachment.mimeType,
      createdAt: attachment.createdAt.toISOString(),
    };
  }

  private toCommentAttachmentResponse(attachment: {
    id: string;
    url: string;
    key: string;
    size: string;
    mimeType: string;
    comment: {
      id: string;
      authorId: string;
      createdAt: Date;
    };
  }): TaskCommentAttachmentResponseDto {
    return {
      id: attachment.id,
      commentId: attachment.comment.id,
      authorId: attachment.comment.authorId,
      url: attachment.url,
      key: attachment.key,
      size: attachment.size,
      mimeType: attachment.mimeType,
      createdAt: attachment.comment.createdAt.toISOString(),
    };
  }

  private toCommentResponse(
    comment: {
      id: string;
      taskId: string;
      authorId: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      editedAt?: Date | null;
      actorAccountId?: string | null;
      actorDisplayName?: string | null;
      actorKind?: 'OWNER' | 'MANAGER' | null;
      media?: {
        id: string;
        url: string;
        key: string;
        size: string;
        mimeType: string;
      }[];
    },
    viewerId: string,
    viewerLastReadAt: Date | null,
    peerLastReadAt: Date | null
  ): TaskCommentResponseDto {
    return {
      id: comment.id,
      taskId: comment.taskId,
      authorId: comment.authorId,
      content: comment.content,
      media: (comment.media ?? []).map(item => ({
        id: item.id,
        url: item.url,
        key: item.key,
        size: item.size,
        mimeType: item.mimeType,
      })),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      editedAt: comment.editedAt?.toISOString() ?? null,
      isRead: isCommentRead(
        comment,
        viewerId,
        viewerLastReadAt,
        peerLastReadAt
      ),
      actorAccountId: comment.actorAccountId ?? null,
      actorDisplayName: comment.actorDisplayName ?? null,
      actorKind: comment.actorKind ?? null,
    };
  }

  private async getTaskCommentReadState(
    task: Pick<Task, 'id' | 'ownerId' | 'executorId'>,
    userId: string
  ): Promise<{
    viewerLastReadAt: Date | null;
    peerLastReadAt: Date | null;
  }> {
    this.assertParticipant(task, userId);

    const peerId = this.resolveOtherParticipantId(task, userId);
    const userIds = peerId ? [userId, peerId] : [userId];

    const states = await this.prisma.taskCommentReadState.findMany({
      where: {
        taskId: task.id,
        userId: { in: userIds },
      },
      select: { userId: true, lastReadAt: true },
    });

    const viewer = states.find(state => state.userId === userId);
    const peer = peerId
      ? states.find(state => state.userId === peerId)
      : undefined;

    return {
      viewerLastReadAt: viewer?.lastReadAt ?? null,
      peerLastReadAt: peer?.lastReadAt ?? null,
    };
  }

  private async mapCommentsWithReadState(
    viewerId: string,
    comments: Array<{
      id: string;
      taskId: string;
      authorId: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      editedAt?: Date | null;
      media?: {
        id: string;
        url: string;
        key: string;
        size: string;
        mimeType: string;
      }[];
    }>
  ): Promise<TaskCommentResponseDto[]> {
    if (comments.length === 0) {
      return [];
    }

    const taskIds = [...new Set(comments.map(comment => comment.taskId))];
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, ownerId: true, executorId: true },
    });
    const tasksById = new Map(tasks.map(task => [task.id, task]));

    const readStates = await this.prisma.taskCommentReadState.findMany({
      where: { taskId: { in: taskIds } },
      select: { taskId: true, userId: true, lastReadAt: true },
    });

    const readStateKey = (taskId: string, userId: string) =>
      `${taskId}:${userId}`;
    const lastReadByKey = new Map(
      readStates.map(state => [
        readStateKey(state.taskId, state.userId),
        state.lastReadAt,
      ])
    );

    return comments.map(comment => {
      const task = tasksById.get(comment.taskId);
      const peerId = task
        ? this.resolveOtherParticipantId(task, viewerId)
        : null;

      return this.toCommentResponse(
        comment,
        viewerId,
        lastReadByKey.get(readStateKey(comment.taskId, viewerId)) ?? null,
        peerId
          ? (lastReadByKey.get(readStateKey(comment.taskId, peerId)) ?? null)
          : null
      );
    });
  }
}
