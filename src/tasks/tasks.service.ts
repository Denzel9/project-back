import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  Task,
  TaskActivityType,
  TaskMediaKind,
  TaskStatus,
} from '@prisma/client';
import { ApplicationApplicantDto } from '../applications/dto/application-applicant.dto';
import { AuthUser } from '../auth/auth.types';
import { buildCalendarDayFilter } from '../common/date/calendar-day-filter';
import { StorageService } from '../media/storage.service';
import { ALLOWED_DOCUMENT_MIME_TYPES } from '../media/media.constants';
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
import { ListTasksQueryDto, TaskListRole } from './dto/list-tasks-query.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskActivityResponseDto } from './dto/task-activity-response.dto';
import {
  TaskCommentResponseDto,
  TaskResponseDto,
} from './dto/task-response.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskWithCommentsSummaryDto } from './dto/task-with-comments-summary.dto';
import {
  buildCommentPreview,
  resolveTaskTitle,
} from './task-comment-preview.util';

type PrismaTx = Prisma.TransactionClient;

export const taskWithMediaInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
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
  executor: {
    include: executorInclude,
  },
} satisfies Prisma.TaskInclude;

const commentWithMediaInclude = {
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.TaskCommentInclude;

const taskInclude = {
  ...taskListInclude,
  executor: {
    select: {
      id: true,
    },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: commentWithMediaInclude,
  },
} satisfies Prisma.TaskInclude;

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
};

type TaskWithRelations = TaskWithMedia & {
  comments?: Array<{
    id: string;
    taskId: string;
    authorId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    media: {
      id: string;
      url: string;
      key: string;
      size: string;
      mimeType: string;
    }[];
  }>;
};

type TaskChange = {
  type: TaskActivityType;
  payload: Prisma.InputJsonValue;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async createFromAcceptedApplication(
    tx: PrismaTx,
    applicationId: string
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
        ...(dto.isExecutorApprove !== undefined && {
          isExecutorApprove: dto.isExecutorApprove,
        }),
        ...(dto.isCompanyAction !== undefined && {
          isCompanyAction: dto.isCompanyAction,
        }),
      },
      include: taskListInclude,
    });

    return this.toResponse(task, {
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

    const where = this.buildListWhere(user.userId, query, options);

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
    userId: string,
    query: ListTasksQueryDto,
    options: {
      executorApprovalFilter?: 'unapproved';
      forceExecutorRole?: boolean;
    } = {}
  ): Prisma.TaskWhereInput {
    const updatedAtFilter = buildCalendarDayFilter(query.updatedDate);
    const role = options.forceExecutorRole ? TaskListRole.EXECUTOR : query.role;
    const executorApprovalWhere =
      options.executorApprovalFilter === 'unapproved'
        ? { isExecutorApprove: null }
        : {};

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
      ...(query.status !== undefined && { status: query.status }),
      ...(query.postId !== undefined && { postId: query.postId }),
      ...(updatedAtFilter !== undefined && { updatedAt: updatedAtFilter }),
      ...(query.q !== undefined && {
        post: this.buildPostSearchWhere(query.q),
      }),
    };

    return where;
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

  private buildTasksWithCommentsWhere(
    userId: string,
    query: ListTasksWithCommentsQueryDto
  ): Prisma.TaskCommentWhereInput {
    const taskWhere: Prisma.TaskWhereInput = {
      ...this.buildParticipantTaskWhere(userId, query.role),
      ...(query.postId !== undefined && { postId: query.postId }),
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
    taskIds: string[],
    readAfter?: string
  ): Promise<Map<string, number>> {
    if (readAfter === undefined || taskIds.length === 0) {
      return new Map();
    }

    const readAfterDate = new Date(readAfter);

    if (Number.isNaN(readAfterDate.getTime())) {
      throw new BadRequestException('readAfter должен быть валидной датой ISO');
    }

    const groups = await this.prisma.taskComment.groupBy({
      by: ['taskId'],
      where: {
        taskId: { in: taskIds },
        createdAt: { gt: readAfterDate },
        authorId: { not: userId },
      },
      _count: { _all: true },
    });

    return new Map(
      groups.map(group => [group.taskId, group._count._all])
    );
  }

  async findById(user: AuthUser, id: string): Promise<TaskResponseDto> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    this.assertParticipant(task, user.userId);

    return this.toResponse(task, {
      includeComments: true,
      ...this.participantResponseOptions(user.userId, task),
    });
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateTaskDto
  ): Promise<TaskResponseDto> {
    const task = await this.getTaskOrThrow(id);
    this.assertParticipant(task, user.userId);

    const isOwner = task.ownerId === user.userId;
    const data = this.buildUpdateData(dto, isOwner);
    const changes = this.collectTaskChanges(task, dto, isOwner);

    if (isOwner && dto.executorId !== undefined) {
      await this.validateExecutor(dto.executorId, task.ownerId);
    }

    const updated = await this.prisma.$transaction(async tx => {
      const updatedTask = await tx.task.update({
        where: { id },
        data,
        include: taskWithMediaInclude,
      });

      for (const change of changes) {
        await this.logActivity(
          id,
          user.userId,
          change.type,
          change.payload,
          tx
        );
      }

      return updatedTask;
    });

    return this.toResponse(updated);
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

  async addMedia(
    taskId: string,
    actorId: string,
    data: { url: string; key: string; size: string; mimeType: string },
    kind: TaskMediaKind = TaskMediaKind.MAIN
  ) {
    const count = await this.prisma.taskMedia.count({
      where: { taskId, kind },
    });

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

    await this.logActivity(taskId, actorId, TaskActivityType.MEDIA_ADDED, {
      mediaId: media.id,
      kind: media.kind,
      url: media.url,
      key: media.key,
      mimeType: media.mimeType,
      size: media.size,
    });

    return media;
  }

  async removeMedia(
    userId: string,
    taskId: string,
    mediaId: string
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
        tx
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

  async listAllComments(
    user: AuthUser,
    query: ListAllTaskCommentsQueryDto
  ) {
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

    return {
      items: items.map(comment => this.toCommentResponse(comment)),
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

    const [tasks, lastComments] = await Promise.all([
      this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: {
          id: true,
          title: true,
          post: { select: { title: true } },
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
      taskIds,
      query.readAfter
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

      const item: TaskWithCommentsSummaryDto = {
        taskId: group.taskId,
        title: resolveTaskTitle(task.title, task.post.title),
        lastComment: {
          preview: buildCommentPreview(
            lastComment.content,
            lastComment._count.media > 0
          ),
          createdAt: lastComment.createdAt.toISOString(),
          authorId: lastComment.authorId,
        },
        commentsCount: group.commentsCount,
      };

      const unreadCount = unreadByTaskId.get(group.taskId);
      if (unreadCount !== undefined) {
        item.unreadCount = unreadCount;
      }

      items.push(item);
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
      items: items.map(comment => this.toCommentResponse(comment)),
      total,
      page,
      limit,
    };
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
      items: items.map(comment => this.toCommentResponse(comment)),
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

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId: user.userId,
        content,
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

    return this.toCommentResponse(comment);
  }

  async updateComment(
    user: AuthUser,
    taskId: string,
    commentId: string,
    dto: UpdateTaskCommentDto
  ): Promise<TaskCommentResponseDto> {
    const task = await this.getTaskOrThrow(taskId);
    this.assertParticipant(task, user.userId);

    const comment = await this.getCommentOrThrow(taskId, commentId);
    this.assertCanModifyComment(task, comment.authorId, user.userId);

    const updated = await this.prisma.taskComment.update({
      where: { id: commentId },
      data: { content: dto.content.trim() },
    });

    return this.toCommentResponse(updated);
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
  }

  private async logActivity(
    taskId: string,
    actorId: string,
    type: TaskActivityType,
    payload: Prisma.InputJsonValue,
    tx?: PrismaTx
  ) {
    const client = tx ?? this.prisma;

    return client.taskActivity.create({
      data: {
        taskId,
        actorId,
        type,
        payload,
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

  private assertParticipant(task: Task, userId: string) {
    if (
      task.ownerId !== userId &&
      (task.executorId === null || task.executorId !== userId)
    ) {
      throw new ForbiddenException('Нет доступа к этой задаче');
    }
  }

  private assertCanModifyComment(task: Task, authorId: string, userId: string) {
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
      includeComments?: boolean;
      includeExecutor?: boolean;
      includePost?: boolean;
      includeOwner?: boolean;
    } = {}
  ): TaskResponseDto {
    return {
      id: task.id,
      applicationId: task.applicationId ?? null,
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
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      ...(options.includeComments &&
        'comments' in task &&
        task.comments && {
        comments: task.comments.map(comment =>
          this.toCommentResponse(comment)
        ),
      }),
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
        owner: {
          id: task.owner.id,
          avatar: task.owner.avatar ?? undefined,
          creatorProfile: task.owner.creatorProfile
            ? {
              name: task.owner.creatorProfile.name,
              lastName: task.owner.creatorProfile.lastName,
            }
            : undefined,
          companyProfile: task.owner.companyProfile
            ? {
              companyName: task.owner.companyProfile.companyName,
            }
            : undefined,
        },
      }),
    };
  }

  private toActivityResponse(activity: {
    id: string;
    taskId: string;
    actorId: string;
    type: TaskActivityType;
    payload: Prisma.JsonValue;
    createdAt: Date;
  }): TaskActivityResponseDto {
    return {
      id: activity.id,
      taskId: activity.taskId,
      actorId: activity.actorId,
      type: activity.type,
      payload: activity.payload as Record<string, unknown>,
      createdAt: activity.createdAt.toISOString(),
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

  private toCommentResponse(comment: {
    id: string;
    taskId: string;
    authorId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    media?: {
      id: string;
      url: string;
      key: string;
      size: string;
      mimeType: string;
    }[];
  }): TaskCommentResponseDto {
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
    };
  }
}
