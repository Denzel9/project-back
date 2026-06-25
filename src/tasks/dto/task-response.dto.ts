import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
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

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiPropertyOptional({ type: [TaskCommentResponseDto] })
  comments?: TaskCommentResponseDto[];
}
