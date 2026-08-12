import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskResponseDto } from '../tasks/dto/task-response.dto';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { InstantiateTaskTemplateDto } from './dto/instantiate-task-template.dto';
import { TaskTemplateResponseDto } from './dto/task-template-response.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';

@Injectable()
export class TaskTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService
  ) {}

  async list(user: AuthUser): Promise<TaskTemplateResponseDto[]> {
    const items = await this.prisma.taskTemplate.findMany({
      where: { ownerId: user.userId },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map(item => this.toResponse(item));
  }

  async getById(
    user: AuthUser,
    id: string
  ): Promise<TaskTemplateResponseDto> {
    const item = await this.findOwned(user.userId, id);
    return this.toResponse(item);
  }

  async create(
    user: AuthUser,
    dto: CreateTaskTemplateDto
  ): Promise<TaskTemplateResponseDto> {
    const item = await this.prisma.taskTemplate.create({
      data: {
        ownerId: user.userId,
        name: dto.name.trim(),
        title: dto.title === undefined ? null : dto.title,
        description: dto.description ?? '',
        photoCount: dto.photoCount ?? '0',
        videoCount: dto.videoCount ?? '0',
        urgent: dto.urgent ?? false,
        ...(dto.brief !== undefined && {
          brief:
            dto.brief === null
              ? Prisma.JsonNull
              : (dto.brief as unknown as Prisma.InputJsonValue),
        }),
        ...(dto.deliverables !== undefined && {
          deliverables:
            dto.deliverables === null
              ? Prisma.JsonNull
              : (dto.deliverables as unknown as Prisma.InputJsonValue),
        }),
      },
    });

    return this.toResponse(item);
  }

  async createFromTask(
    user: AuthUser,
    taskId: string
  ): Promise<TaskTemplateResponseDto> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        ownerId: true,
        title: true,
        description: true,
        photoCount: true,
        videoCount: true,
        urgent: true,
        brief: true,
        deliverables: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    if (task.ownerId !== user.userId) {
      throw new ForbiddenException(
        'Сохранять шаблон может только владелец задачи'
      );
    }

    const name =
      task.title?.trim() ||
      `Шаблон от ${new Date().toLocaleDateString('ru-RU')}`;

    const item = await this.prisma.taskTemplate.create({
      data: {
        ownerId: user.userId,
        name,
        title: task.title,
        description: task.description,
        photoCount: task.photoCount,
        videoCount: task.videoCount,
        urgent: task.urgent,
        brief:
          task.brief === null
            ? Prisma.JsonNull
            : (task.brief as Prisma.InputJsonValue),
        deliverables:
          task.deliverables === null
            ? Prisma.JsonNull
            : (task.deliverables as Prisma.InputJsonValue),
      },
    });

    return this.toResponse(item);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateTaskTemplateDto
  ): Promise<TaskTemplateResponseDto> {
    await this.findOwned(user.userId, id);

    const item = await this.prisma.taskTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.photoCount !== undefined && { photoCount: dto.photoCount }),
        ...(dto.videoCount !== undefined && { videoCount: dto.videoCount }),
        ...(dto.urgent !== undefined && { urgent: dto.urgent }),
        ...(dto.brief !== undefined && {
          brief:
            dto.brief === null
              ? Prisma.JsonNull
              : (dto.brief as unknown as Prisma.InputJsonValue),
        }),
        ...(dto.deliverables !== undefined && {
          deliverables:
            dto.deliverables === null
              ? Prisma.JsonNull
              : (dto.deliverables as unknown as Prisma.InputJsonValue),
        }),
      },
    });

    return this.toResponse(item);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.findOwned(user.userId, id);
    await this.prisma.taskTemplate.delete({ where: { id } });
  }

  async instantiate(
    user: AuthUser,
    id: string,
    dto: InstantiateTaskTemplateDto
  ): Promise<TaskResponseDto> {
    const template = await this.findOwned(user.userId, id);

    return this.tasksService.create(user, {
      postId: dto.postId,
      ...(dto.executorId !== undefined && { executorId: dto.executorId }),
      title: template.title,
      description: template.description,
      photoCount: template.photoCount,
      videoCount: template.videoCount,
      urgent: template.urgent,
      ...(template.brief != null && {
        brief: template.brief as never,
      }),
      ...(template.deliverables != null && {
        deliverables: template.deliverables as never,
      }),
    });
  }

  private async findOwned(ownerId: string, id: string) {
    const item = await this.prisma.taskTemplate.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Шаблон не найден');
    }

    if (item.ownerId !== ownerId) {
      throw new ForbiddenException('Нет доступа к шаблону');
    }

    return item;
  }

  private toResponse(item: {
    id: string;
    ownerId: string;
    name: string;
    title: string | null;
    description: string;
    photoCount: string;
    videoCount: string;
    urgent: boolean;
    brief: Prisma.JsonValue | null;
    deliverables: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }): TaskTemplateResponseDto {
    return {
      id: item.id,
      ownerId: item.ownerId,
      name: item.name,
      title: item.title,
      description: item.description,
      photoCount: item.photoCount,
      videoCount: item.videoCount,
      urgent: item.urgent,
      brief: item.brief,
      deliverables: item.deliverables,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
