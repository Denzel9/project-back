import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    example:
      'https://s3.ru-7.storage.selcloud.ru/project-media/user-id/uuid.jpg',
    description: 'Публичный URL загруженного файла',
  })
  url: string;

  @ApiProperty({
    example: 'user-id/uuid.jpg',
    description: 'Ключ объекта в бакете',
  })
  key: string;

  @ApiProperty({ example: 'image/jpeg', description: 'MIME-тип файла' })
  mimeType: string;

  @ApiProperty({ example: 12345, description: 'Размер файла в байтах' })
  size: number;
}
