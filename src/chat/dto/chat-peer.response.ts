import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class ChatPeerResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Role, example: Role.CREATOR })
  role: Role;

  @ApiProperty({ nullable: true, example: 'https://example.com/avatar.png' })
  avatar: string | null;

  @ApiProperty({ example: 'John Doe' })
  displayName: string;

  @ApiProperty({
    description: 'Собеседник сейчас в сети (есть активное WebSocket-подключение к /chat)',
  })
  isOnline: boolean;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description: 'Когда собеседник был в сети в последний раз',
  })
  lastSeenAt: Date | null;
}
