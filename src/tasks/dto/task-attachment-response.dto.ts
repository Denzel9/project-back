import { ApiProperty } from '@nestjs/swagger';
import { TaskMediaKind } from '@prisma/client';

export class TaskAttachmentResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Id записи TaskMedia' })
  id: string;

  @ApiProperty({
    enum: TaskMediaKind,
    description: 'MAIN — основные вложения, REPORT — отчёт',
  })
  kind: TaskMediaKind;

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

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
