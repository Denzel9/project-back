import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
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
import {
  transformCsvArray,
  transformTrimmedString,
} from '../../common/query/query-param.transforms';
import { PartnerSort } from './partner-sort.enum';

export class ListApplicationPartnersQueryDto {
  @ApiPropertyOptional({
    description:
      'Поиск: для соискателей — имя/фамилия; для компаний — название компании; также по названию поста',
    example: 'реклама',
  })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Фильтр по конкретному пользователю' })
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
    description: 'Несколько статусов через запятую',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsEnum(ApplicationStatus, { each: true })
  statuses?: ApplicationStatus[];

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дате обновления отклика (UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'updatedDate должен быть в формате YYYY-MM-DD',
  })
  updatedDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дате создания отклика (UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'createdDate должен быть в формате YYYY-MM-DD',
  })
  createdDate?: string;

  @ApiPropertyOptional({
    enum: PartnerSort,
    default: PartnerSort.RECENT,
    description: 'recent — по последнему отклику; name — по имени/компании',
  })
  @IsOptional()
  @IsEnum(PartnerSort)
  sort?: PartnerSort = PartnerSort.RECENT;

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
