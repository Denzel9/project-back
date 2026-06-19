import { ApiProperty } from '@nestjs/swagger';
import { TaskAttachmentResponseDto } from './task-attachment-response.dto';

export class ListTaskAttachmentsResponseDto {
  @ApiProperty({ type: TaskAttachmentResponseDto, isArray: true })
  items: TaskAttachmentResponseDto[];

  @ApiProperty({ example: 15 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
