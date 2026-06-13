import { ApiProperty } from '@nestjs/swagger';
import { ChatAttachmentResponse } from './chat-attachment.response';

export class ListAttachmentsResponse {
  @ApiProperty({ type: ChatAttachmentResponse, isArray: true })
  items: ChatAttachmentResponse[];

  @ApiProperty({ example: 15 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
