import { ApiProperty } from '@nestjs/swagger';

import { ChatMessageResponse } from './chat-message.response';

export class ListMessagesResponse {
  @ApiProperty({ type: ChatMessageResponse, isArray: true })
  items: ChatMessageResponse[];

  @ApiProperty({
    description: 'Есть сообщения старше самого старого в items',
  })
  hasOlder: boolean;

  @ApiProperty({
    description: 'Есть сообщения новее самого нового в items',
  })
  hasNewer: boolean;
}
