import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
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
  transformTrimmedString,
} from '../../common/query/query-param.transforms';
import { PartnerSort } from './partner-sort.enum';

export class ListTaskPartnersQueryDto {
  @ApiPropertyOptional({
    description:
      'Поиск: для исполнителей — имя/фамилия; для заказчиков — название компании',
    example: 'иван',
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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по конкретному пользователю',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    enum: TaskStatus,
    isArray: true,
    description: 'Несколько статусов через запятую',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsEnum(TaskStatus, { each: true })
  statuses?: TaskStatus[];

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дате обновления задачи (UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'updatedDate должен быть в формате YYYY-MM-DD',
  })
  updatedDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дате создания задачи (UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'createdDate должен быть в формате YYYY-MM-DD',
  })
  createdDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isExecutorApprove?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({
    enum: PartnerSort,
    default: PartnerSort.RECENT,
    description: 'recent — по последней задаче; name — по имени/компании',
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
