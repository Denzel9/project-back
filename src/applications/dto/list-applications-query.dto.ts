import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, PostAuthorType } from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
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
import {
  transformCsvArray,
  transformOptionalBoolean,
} from '../../common/query/query-param.transforms';

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по посту (для входящих откликов)',
  })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Фильтр по соискателю (applicantId). Для `/applications/incoming` — отклики конкретного креатора',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    enum: ApplicationStatus,
    isArray: true,
    description: 'Несколько статусов через запятую, например `NEW,VIEWED`',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsEnum(ApplicationStatus, { each: true })
  statuses?: ApplicationStatus[];

  @ApiPropertyOptional({
    description:
      'Поиск: для /applications/mine — по названию поста или компании-автора; ' +
      'для /applications/incoming — по названию поста',
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
    description: 'Фильтр по дате создания отклика (календарный день, UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'createdDate должен быть в формате YYYY-MM-DD',
  })
  createdDate?: string;

  @ApiPropertyOptional({
    description: 'Только отклики на архивные объявления',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isArchived?: boolean;

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
