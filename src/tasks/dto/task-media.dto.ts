import { ApiProperty } from '@nestjs/swagger';
import { TaskMediaKind } from '@prisma/client';

export class TaskMediaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example:
      'https://s3.ru-7.storage.selcloud.ru/project-media/tasks/uuid/file.jpg',
  })
  url: string;

  @ApiProperty({ example: 'tasks/uuid/file.jpg' })
  key: string;

  @ApiProperty({ example: '12345' })
  size: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({
    example: 'brief.pdf',
    required: false,
    nullable: true,
    description: 'Оригинальное имя файла',
  })
  fileName: string | null;

  @ApiProperty({
    enum: TaskMediaKind,
    description: 'MAIN — основные вложения задачи, REPORT — отчёт исполнителя',
  })
  kind: TaskMediaKind;
}
