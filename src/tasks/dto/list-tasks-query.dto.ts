import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
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

export enum TaskListRole {
  OWNER = 'owner',
  EXECUTOR = 'executor',
}

export class ListTasksQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по посту — задачи, связанные с этим postId',
  })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({
    enum: TaskListRole,
    description:
      'owner — задачи на мои посты; executor — задачи где я исполнитель',
  })
  @IsOptional()
  @IsEnum(TaskListRole)
  role?: TaskListRole;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дате обновления задачи (календарный день, UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'updatedDate должен быть в формате YYYY-MM-DD',
  })
  updatedDate?: string;

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
