import { ApiProperty } from '@nestjs/swagger';

export class ChatAttachmentResponse {
  @ApiProperty({ format: 'uuid', description: 'Id записи MessageMedia' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  messageId: string;

  @ApiProperty({ format: 'uuid' })
  senderId: string;

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

  @ApiProperty({ format: 'date-time', description: 'Дата сообщения, к которому относится вложение' })
  createdAt: Date;
}
