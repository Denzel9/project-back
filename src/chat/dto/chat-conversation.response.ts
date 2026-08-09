import { ApiProperty } from '@nestjs/swagger';
import { ChatMessageResponse } from './chat-message.response';
import { ChatPeerResponse } from './chat-peer.response';

export class ChatConversationResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: ChatPeerResponse })
  peer: ChatPeerResponse;

  @ApiProperty({ type: ChatMessageResponse, nullable: true })
  lastMessage: ChatMessageResponse | null;

  @ApiProperty({
    description: 'Количество непрочитанных входящих сообщений',
    example: 3,
  })
  unreadCount: number;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description:
      'Сообщение, помеченное непрочитанным вручную (только оно, не все после него)',
  })
  unreadAnchorMessageId: string | null;

  @ApiProperty({
    description:
      'Диалог помечен непрочитанным вручную (точка в списке без числа)',
  })
  isMarkedUnread: boolean;

  @ApiProperty({
    description: 'Закреплён ли диалог для текущего пользователя',
  })
  isPinned: boolean;

  @ApiProperty({
    description: 'Диалог «Заметки» (чат с самим собой)',
  })
  isNotes: boolean;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}
