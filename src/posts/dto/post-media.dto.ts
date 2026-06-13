import { ApiProperty } from '@nestjs/swagger';

export class PostMediaDto {
  @ApiProperty({
    example:
      'https://s3.ru-7.storage.selcloud.ru/project-media/posts/uuid/file.jpg',
  })
  url: string;

  @ApiProperty({ example: 'posts/uuid/file.jpg' })
  key: string;

  @ApiProperty({ example: '12345' })
  size: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;
}
