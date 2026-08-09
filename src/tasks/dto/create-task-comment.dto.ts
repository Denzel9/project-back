import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TaskCommentMediaInputDto } from './task-comment-media-input.dto';

export class CreateTaskCommentDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Текст комментария. Можно опустить, если передан media[]',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'UUID комментария, на который отвечают',
  })
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional({
    type: [TaskCommentMediaInputDto],
    description:
      'Вложения после `POST /media/upload?taskId={id}&forComment=true`. Нужен content или media.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskCommentMediaInputDto)
  media?: TaskCommentMediaInputDto[];
}
