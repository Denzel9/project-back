import { ApiProperty } from '@nestjs/swagger';

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

export class TaskWithCommentsRecipientDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Отображаемое имя собеседника по задаче' })
  displayName: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

export class TaskWithCommentsSummaryDto {
  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({
    nullable: true,
    description: 'title задачи или название поста, если title не задан',
  })
  title: string | null;

  @ApiProperty({
    type: TaskWithCommentsRecipientDto,
    nullable: true,
    description: 'Другой участник задачи (собеседник) относительно текущего пользователя',
  })
  recipient: TaskWithCommentsRecipientDto | null;

  @ApiProperty({ type: TaskLastCommentPreviewDto })
  lastComment: TaskLastCommentPreviewDto;

  @ApiProperty()
  commentsCount: number;

  @ApiProperty({
    description:
      'Число непрочитанных комментариев от других участников ' +
      '(createdAt > lastReadAt текущего пользователя)',
  })
  unreadCount: number;
}
