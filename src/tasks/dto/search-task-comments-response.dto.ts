import { ApiProperty } from '@nestjs/swagger';
import { TaskCommentResponseDto } from './task-response.dto';

export class SearchTaskCommentsResponseDto {
  @ApiProperty({ type: TaskCommentResponseDto, isArray: true })
  items: TaskCommentResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
