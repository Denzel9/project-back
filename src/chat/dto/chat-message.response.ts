import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  conversationId: string;

  @ApiProperty({ format: 'uuid' })
  senderId: string;

  @ApiProperty({ example: 'Hello!' })
  content: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        key: { type: 'string' },
        size: { type: 'string' },
        mimeType: { type: 'string' },
      },
    },
  })
  media: {
    url: string;
    key: string;
    size: string;
    mimeType: string;
  }[];

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}
