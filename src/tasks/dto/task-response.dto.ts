import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { BloggerRequirementsDto } from '../../posts/dto/blogger-requirements.dto';
import { CooperationDetailsDto } from '../../posts/dto/cooperation-details.dto';
import { PostBriefDto } from '../../posts/dto/post-brief.dto';
import { PostDeliverableDto } from '../../posts/dto/post-deliverable.dto';
import { PostLocationDto } from '../../posts/dto/post-location.dto';
import { TaskCommentMediaDto } from './task-comment-media.dto';
import { TaskMediaDto } from './task-media.dto';

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
}

export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  applicationId: string | null;

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

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
