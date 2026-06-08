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

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}
