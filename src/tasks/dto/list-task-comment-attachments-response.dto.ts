import { ApiProperty } from '@nestjs/swagger';
import { TaskCommentAttachmentResponseDto } from './task-comment-attachment-response.dto';

export class ListTaskCommentAttachmentsResponseDto {
  @ApiProperty({ type: TaskCommentAttachmentResponseDto, isArray: true })
  items: TaskCommentAttachmentResponseDto[];

  @ApiProperty({ example: 15 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
