import { ApiProperty } from '@nestjs/swagger';

export class TaskCommentAttachmentResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Id записи TaskCommentMedia' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  commentId: string;

  @ApiProperty({ format: 'uuid' })
  authorId: string;

  @ApiProperty({
    example:
      'https://8e99a641-b75a-4250-a2a3-d3ec2dbeb156.selstorage.ru/tasks/uuid/file.jpg',
  })
  url: string;

  @ApiProperty({ example: 'tasks/uuid/file.jpg' })
  key: string;

  @ApiProperty({ example: '12345' })
  size: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Дата комментария, к которому относится вложение',
  })
  createdAt: string;
}
