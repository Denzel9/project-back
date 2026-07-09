import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { transformOptionalBoolean } from '../../common/query/query-param.transforms';
import { TaskCalendarDateField } from './task-calendar-date-field.enum';
import { TaskListRole } from './list-tasks-query.dto';

export class ListTasksCalendarQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    description:
      'Начало диапазона (UTC, включительно). Поле задаётся через `dateField` (по умолчанию `createdAt`).',
    example: '2026-06-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateFrom должен быть в формате YYYY-MM-DD',
  })
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'Конец диапазона (UTC, включительно). Можно передать только dateFrom или только dateTo.',
    example: '2026-06-30',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateTo должен быть в формате YYYY-MM-DD',
  })
  dateTo?: string;

  @ApiPropertyOptional({
    enum: TaskCalendarDateField,
    default: TaskCalendarDateField.CREATED_AT,
    description:
      'По какому полю задачи фильтровать `dateFrom` / `dateTo`: `createdAt`, `updatedAt` или `finalDate`.',
  })
  @IsOptional()
  @IsEnum(TaskCalendarDateField)
  dateField?: TaskCalendarDateField = TaskCalendarDateField.CREATED_AT;

  @ApiPropertyOptional({ description: 'Только срочные (`urgent: true`) или несрочные (`urgent: false`)' })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Фильтр по владельцу задачи (owner.id)' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Фильтр по исполнителю (executor.id)' })
  @IsOptional()
  @IsUUID()
  executorId?: string;

  @ApiPropertyOptional({
    enum: TaskListRole,
    description:
      'owner — задачи на мои посты; executor — задачи где я исполнитель',
  })
  @IsOptional()
  @IsEnum(TaskListRole)
  role?: TaskListRole;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;
}
