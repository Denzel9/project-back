import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, PostAuthorType } from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по посту (для входящих откликов)',
  })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Поиск по названию поста или названию компании-автора',
    example: 'реклама',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  @MinLength(1)
  q?: string;

  @ApiPropertyOptional({
    enum: PostAuthorType,
    description: 'Фильтр по типу поста (CREATOR / COMPANY)',
  })
  @IsOptional()
  @IsEnum(PostAuthorType)
  type?: PostAuthorType;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дате обновления отклика (календарный день, UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'updatedDate должен быть в формате YYYY-MM-DD',
  })
  updatedDate?: string;

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
