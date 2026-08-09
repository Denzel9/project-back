import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { BloggerRequirementsDto } from '../../posts/dto/blogger-requirements.dto';
import { CooperationDetailsDto } from '../../posts/dto/cooperation-details.dto';
import { PostBriefDto } from '../../posts/dto/post-brief.dto';
import { PostDeliverableDto } from '../../posts/dto/post-deliverable.dto';
import { PostLocationDto } from '../../posts/dto/post-location.dto';
import { TaskCommentMediaDto } from './task-comment-media.dto';
import { TaskMediaDto } from './task-media.dto';
import { TaskAnnulmentDto } from './task-annulment.dto';
import { TaskDeadlineExtensionDto } from './task-deadline-extension.dto';

export class TaskCommentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({ format: 'uuid' })
  authorId: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [TaskCommentMediaDto], default: [] })
  media: TaskCommentMediaDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description: 'Когда текст комментария последний раз редактировали',
  })
  editedAt: string | null;

  @ApiProperty({
    description:
      'Прочитанность: для входящих — зритель прочитал; для исходящих — собеседник прочитал',
  })
  isRead: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  actorAccountId: string | null;

  @ApiPropertyOptional({ nullable: true })
  actorDisplayName: string | null;

  @ApiPropertyOptional({ enum: ['OWNER', 'MANAGER'], nullable: true })
  actorKind: 'OWNER' | 'MANAGER' | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  replyToId: string | null;

  @ApiPropertyOptional({ nullable: true })
  replyToPreview: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  replyToSenderId: string | null;

  @ApiPropertyOptional({ nullable: true })
  replyToSenderName: string | null;
}

export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  applicationId: string | null;

  @ApiProperty({ format: 'uuid' })
  postId: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  executorId: string | null;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty({ enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty({
    type: [TaskMediaDto],
    description: 'Основные вложения (kind=MAIN)',
  })
  media: TaskMediaDto[];

  @ApiProperty({
    type: [TaskMediaDto],
    description: 'Вложения отчёта исполнителя (kind=REPORT)',
  })
  reportMedia: TaskMediaDto[];

  @ApiProperty({
    description:
      'Описание задачи в формате Markdown. Сервер хранит как есть, рендеринг на клиенте.',
    example: '## Требования\n\n- 3 фото\n- Дедлайн **завтра**',
  })
  description: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  finalDate: string | null;

  @ApiProperty()
  photoCount: string;

  @ApiProperty()
  videoCount: string;

  @ApiProperty()
  urgent: boolean;

  @ApiProperty({ nullable: true })
  isExecutorApprove: boolean | null;

  @ApiProperty()
  isCompanyAction: boolean;

  @ApiPropertyOptional({ type: PostLocationDto, nullable: true })
  location?: PostLocationDto | null;

  @ApiPropertyOptional({ type: BloggerRequirementsDto, nullable: true })
  bloggerRequirements?: BloggerRequirementsDto | null;

  @ApiPropertyOptional({ type: CooperationDetailsDto, nullable: true })
  cooperationDetails?: CooperationDetailsDto | null;

  @ApiPropertyOptional({ type: PostBriefDto, nullable: true })
  brief?: PostBriefDto | null;

  @ApiPropertyOptional({ type: [PostDeliverableDto], nullable: true })
  deliverables?: PostDeliverableDto[] | null;

  @ApiPropertyOptional({
    type: TaskAnnulmentDto,
    nullable: true,
    description: 'Текущий PENDING-запрос на аннулирование (если есть)',
  })
  annulment?: TaskAnnulmentDto | null;

  @ApiPropertyOptional({
    type: [TaskAnnulmentDto],
    description: 'История запросов на аннулирование',
  })
  annulments?: TaskAnnulmentDto[];

  @ApiPropertyOptional({
    type: TaskDeadlineExtensionDto,
    nullable: true,
    description: 'Текущий PENDING-запрос на перенос дедлайна (если есть)',
  })
  deadlineExtension?: TaskDeadlineExtensionDto | null;

  @ApiPropertyOptional({
    type: [TaskDeadlineExtensionDto],
    description: 'История запросов на перенос дедлайна',
  })
  deadlineExtensions?: TaskDeadlineExtensionDto[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Account ответственного (кто создал задачу / принял отклик)',
  })
  assigneeAccountId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Снимок имени ответственного на момент создания',
  })
  assigneeDisplayName: string | null;

  @ApiPropertyOptional({
    enum: ['OWNER', 'MANAGER'],
    nullable: true,
    description: 'OWNER — владелец профиля, MANAGER — менеджер аккаунта',
  })
  assigneeKind: 'OWNER' | 'MANAGER' | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
