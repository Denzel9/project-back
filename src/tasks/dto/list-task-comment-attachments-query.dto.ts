import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum TaskCommentAttachmentTypeFilter {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export class ListTaskCommentAttachmentsQueryDto {
  @ApiPropertyOptional({
    enum: TaskCommentAttachmentTypeFilter,
    description:
      'Фильтр по типу: image — image/*, video — video/*, document — PDF, Excel, Word',
  })
  @IsOptional()
  @IsEnum(TaskCommentAttachmentTypeFilter)
  type?: TaskCommentAttachmentTypeFilter;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
