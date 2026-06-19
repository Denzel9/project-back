import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum TaskAttachmentKindFilter {
  MAIN = 'main',
  REPORT = 'report',
}

export enum TaskAttachmentTypeFilter {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export class ListTaskAttachmentsQueryDto {
  @ApiPropertyOptional({
    enum: TaskAttachmentKindFilter,
    description: 'Фильтр по назначению: main — основные вложения, report — отчёт',
  })
  @IsOptional()
  @IsEnum(TaskAttachmentKindFilter)
  kind?: TaskAttachmentKindFilter;

  @ApiPropertyOptional({
    enum: TaskAttachmentTypeFilter,
    description:
      'Фильтр по типу: image — image/*, video — video/*, document — PDF, Excel, Word',
  })
  @IsOptional()
  @IsEnum(TaskAttachmentTypeFilter)
  type?: TaskAttachmentTypeFilter;

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
