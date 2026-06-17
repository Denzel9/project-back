import { ApiProperty } from '@nestjs/swagger';

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
}
