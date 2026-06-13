import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum AttachmentTypeFilter {
  IMAGE = 'image',
  VIDEO = 'video',
}

export class ListAttachmentsQueryDto {
  @ApiPropertyOptional({
    enum: AttachmentTypeFilter,
    description: 'Фильтр по типу: image — только image/*, video — только video/*',
  })
  @IsOptional()
  @IsEnum(AttachmentTypeFilter)
  type?: AttachmentTypeFilter;

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
