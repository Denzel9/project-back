import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskLastCommentPreviewDto {
  @ApiProperty({
    description: 'Текст комментария или превью (обрезка длинного текста)',
  })
  preview: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'uuid' })
  authorId: string;
}

export class TaskWithCommentsSummaryDto {
  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({
    nullable: true,
    description: 'title задачи или название поста, если title не задан',
  })
  title: string | null;

  @ApiProperty({ type: TaskLastCommentPreviewDto })
  lastComment: TaskLastCommentPreviewDto;

  @ApiProperty()
  commentsCount: number;

  @ApiPropertyOptional({
    description:
      'Число комментариев от других участников после `readAfter`. ' +
      'Поле есть только если передан query-параметр `readAfter`.',
  })
  unreadCount?: number;
}
