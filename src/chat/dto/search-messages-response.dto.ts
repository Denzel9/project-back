import { ApiProperty } from '@nestjs/swagger';
import { ChatMessageResponse } from './chat-message.response';

export class SearchMessagesResponse {
  @ApiProperty({ type: ChatMessageResponse, isArray: true })
  items: ChatMessageResponse[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
