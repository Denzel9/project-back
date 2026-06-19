import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
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

  @ApiProperty({ type: [TaskMediaDto], default: [] })
  media: TaskMediaDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  applicationId: string;

  @ApiProperty({ format: 'uuid' })
  executorId: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty({ enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ type: [TaskMediaDto] })
  media: TaskMediaDto[];

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

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiPropertyOptional({ type: [TaskCommentResponseDto] })
  comments?: TaskCommentResponseDto[];
}
