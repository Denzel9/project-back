import { ApiProperty } from '@nestjs/swagger';

export class ChatMessagePinResponse {
  @ApiProperty({ format: 'uuid' })
  messageId: string;

  @ApiProperty({ example: 'Закреплённое сообщение' })
  content: string;

  @ApiProperty({
    description: 'Количество вложений у закреплённого сообщения',
  })
  mediaCount: number;

  @ApiProperty({ format: 'date-time' })
  pinnedAt: Date;

  @ApiProperty({ format: 'uuid', nullable: true })
  pinnedById?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

