import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  PostAuthorType,
  Prisma,
  Role,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationApplicantDto } from './dto/application-applicant.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  async create(
    user: AuthUser,
    dto: CreateApplicationDto
  ): Promise<ApplicationResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: dto.postId },
      select: { id: true, ownerId: true, type: true, isArchived: true },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    this.assertCanApply(user, post);

    try {
      const application = await this.prisma.postApplication.create({
        data: {
          postId: dto.postId,
          applicantId: user.userId,
          message: dto.message,
        },
        include: applicationInclude,
      });

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

  async listMine(user: AuthUser, query: ListApplicationsQueryDto) {
    return this.listApplications(
      {
        applicantId: user.userId,
        ...(query.status !== undefined && { status: query.status }),
      },
      query,
      { includePost: true }
    );
  }

  async listIncoming(user: AuthUser, query: ListApplicationsQueryDto) {
    return this.listApplications(
      {
        post: {
          ownerId: user.userId,
          ...(query.postId !== undefined && { id: query.postId }),
        },
        ...(query.status !== undefined && { status: query.status }),
      },
      query,
      { includeApplicant: true }
    );
  }

  async listByPost(user: AuthUser, postId: string, query: ListApplicationsQueryDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { ownerId: true },
    });

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    if (post.ownerId !== user.userId) {
      throw new ForbiddenException('Недостаточно прав для просмотра откликов');
    }

    return this.listApplications(
      {
        postId,
        ...(query.status !== undefined && { status: query.status }),
      },
      query,
      { includeApplicant: true }
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

    const updated = await this.prisma.postApplication.update({
      where: { id },
      data: { status: ApplicationStatus.WITHDRAWN },
      include: applicationInclude,
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

    const updated = await this.prisma.postApplication.update({
      where: { id },
      data: { status: dto.status },
      include: applicationInclude,
    });

    return this.mapApplication(updated, { includeApplicant: true });
  }

  private async listApplications(
    where: Prisma.PostApplicationWhereInput,
    query: ListApplicationsQueryDto,
    options: { includePost?: boolean; includeApplicant?: boolean }
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
      items: items.map((item) => this.mapApplication(item, options)),
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
    }
  ) {
    if (post.ownerId === user.userId) {
      throw new BadRequestException('Нельзя откликнуться на свой пост');
    }

    if (post.isArchived) {
      throw new BadRequestException('Нельзя откликнуться на архивный пост');
    }

    if (user.role === Role.CREATOR && post.type !== PostAuthorType.COMPANY) {
      throw new BadRequestException(
        'CREATOR может откликаться только на посты COMPANY'
      );
    }

    if (user.role === Role.COMPANY && post.type !== PostAuthorType.CREATOR) {
      throw new BadRequestException(
        'COMPANY может откликаться только на посты CREATOR'
      );
    }
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
      postId: application.postId,
      message: application.message,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      ...(options.includePost && {
        post: {
          id: application.post.id,
          title: application.post.title,
          type: application.post.type,
          ownerId: application.post.ownerId,
        },
      }),
      ...(options.includeApplicant && {
        applicant: this.mapApplicant(application.applicant),
      }),
    };
  }
}
