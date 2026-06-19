import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApplicationStatus,
  MembershipRole,
  PostAuthorType,
  Prisma,
  Role,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatService } from '../chat/chat.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import {
  canViewPost,
} from '../posts/post-visibility.util';
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
        select: {
          id: true,
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
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly tasksService: TasksService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService
  ) {}

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

    const chatContent = 'Новый отклик';

    try {
      const { application, conversationId, message } =
        await this.prisma.$transaction(async tx => {
          const created = await tx.postApplication.create({
            data: {
              postId: dto.postId,
              applicantId: user.userId,
              message: dto.message,
            },
            include: applicationInclude,
          });

          const chatResult =
            await this.chatService.sendApplicationMessageInTransaction(
              tx,
              user.userId,
              post.ownerId,
              chatContent
            );

          return {
            application: created,
            conversationId: chatResult.conversationId,
            message: chatResult.message,
          };
        });

      this.chatGateway.broadcastMessage(conversationId, message);

      await this.notifyPostOwnerAboutApplication(application);

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
    const postFilter = this.buildPostListFilter(query);
    const updatedAtFilter = this.buildUpdatedDateFilter(query.updatedDate);

    return this.listApplications(
      {
        applicantId: user.userId,
        ...(query.status !== undefined && { status: query.status }),
        ...(postFilter !== undefined && { post: postFilter }),
        ...(updatedAtFilter !== undefined && { updatedAt: updatedAtFilter }),
      },
      query,
      { includePost: true }
    );
  }

  async listIncoming(user: AuthUser, query: ListApplicationsQueryDto) {
    const postFilter = this.buildIncomingPostFilter(user.userId, query);
    const updatedAtFilter = this.buildUpdatedDateFilter(query.updatedDate);

    return this.listApplications(
      {
        post: postFilter,
        ...(query.status !== undefined && { status: query.status }),
        ...(updatedAtFilter !== undefined && { updatedAt: updatedAtFilter }),
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

    return this.listApplications(
      {
        postId,
        ...(!isOwner && { applicantId: user.userId }),
        ...(query.status !== undefined && { status: query.status }),
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

    const updated = await this.prisma.$transaction(async tx => {
      const application = await tx.postApplication.update({
        where: { id },
        data: { status: dto.status },
        include: applicationInclude,
      });

      if (dto.status === ApplicationStatus.ACCEPTED) {
        await this.tasksService.createFromAcceptedApplication(tx, id);
      }

      return application;
    });

    return this.mapApplication(updated, { includeApplicant: true });
  }

  private buildUpdatedDateFilter(
    updatedDate?: string
  ): Prisma.DateTimeFilter | undefined {
    if (updatedDate === undefined) {
      return undefined;
    }

    const start = new Date(`${updatedDate}T00:00:00.000Z`);
    const end = new Date(`${updatedDate}T23:59:59.999Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Некорректная дата');
    }

    return { gte: start, lte: end };
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
    }
  ) {
    if (post.ownerId === user.userId) {
      throw new BadRequestException('Нельзя откликнуться на свой пост');
    }

    if (post.isArchived) {
      throw new BadRequestException('Нельзя откликнуться на архивный пост');
    }

    if (!canViewPost(user.role, user.userId, post)) {
      throw new ForbiddenException('Нельзя откликнуться на пост этого типа');
    }
  }

  private async notifyPostOwnerAboutApplication(
    application: ApplicationWithRelations
  ) {
    try {
      const ownerMembership = await this.prisma.accountMembership.findFirst({
        where: {
          userId: application.post.ownerId,
          role: MembershipRole.OWNER,
        },
        include: {
          account: {
            select: { email: true },
          },
        },
      });

      if (!ownerMembership?.account.email) {
        this.logger.warn(
          `Email OWNER не найден для владельца поста ${application.post.ownerId}`
        );
        return;
      }

      const frontendUrl = this.configService
        .getOrThrow<string>('FRONTEND_URL')
        .replace(/\/$/, '');
      const applicationsUrl = `${frontendUrl}/applications/incoming`;

      await this.mailService.sendApplicationReceivedEmail(
        ownerMembership.account.email,
        {
          postTitle: application.post.title,
          applicantName: this.getApplicantDisplayName(application.applicant),
          message: application.message,
          applicationsUrl,
        }
      );
    } catch (error) {
      this.logger.error(
        'Не удалось отправить письмо о новом отклике',
        error
      );
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
      ...(options.includePost && {
        post: {
          id: application.post.id,
          title: application.post.title,
          type: application.post.type,
          ownerId: application.post.owner.id,
          owner: {
            id: application.post.owner.id,
            creatorProfile: {
              name: application.post.owner.creatorProfile?.name,
              lastName: application.post.owner.creatorProfile?.lastName,
            },
            companyProfile: {
              companyName: application.post.owner.companyProfile?.companyName,
            },
          },
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
