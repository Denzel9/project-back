import { ApiProperty } from '@nestjs/swagger';
import { MessagePinScope } from '@prisma/client';

export class ChatMessagePinResponse {
  @ApiProperty({ format: 'uuid' })
  messageId: string;

  @ApiProperty({ example: 'Закреплённое сообщение' })
  content: string;

  @ApiProperty({
    description: 'Количество вложений у закреплённого сообщения',
  })
  mediaCount: number;

  @ApiProperty({ enum: MessagePinScope })
  scope: MessagePinScope;

  @ApiProperty({ format: 'date-time' })
  pinnedAt: Date;

  @ApiProperty({ format: 'uuid', nullable: true })
  pinnedById?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'uuid' })
  senderId: string;

  @ApiProperty({ example: 'Иван Иванов' })
  senderDisplayName: string;

  @ApiProperty({ nullable: true, example: 'Денис Никитин' })
  actorDisplayName: string | null;

  @ApiProperty({ nullable: true, enum: ['OWNER', 'MANAGER'] })
  actorKind: 'OWNER' | 'MANAGER' | null;
}
