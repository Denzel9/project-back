import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageMediaDto {
  @ApiProperty({
    example:
      'https://8e99a641-b75a-4250-a2a3-d3ec2dbeb156.selstorage.ru/chats/uuid/file.jpg',
  })
  url: string;

  @ApiProperty({ example: 'chats/uuid/file.jpg' })
  key: string;

  @ApiProperty({ example: '12345' })
  size: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;
}
