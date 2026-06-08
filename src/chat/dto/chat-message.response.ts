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

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}
