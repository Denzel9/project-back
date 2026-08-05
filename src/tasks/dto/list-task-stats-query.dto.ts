import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { transformOptionalBoolean } from '../../common/query/query-param.transforms';
import { TaskCalendarDateField } from './task-calendar-date-field.enum';
import { TaskListRole } from './list-tasks-query.dto';

export class ListTaskStatsQueryDto {
  @ApiPropertyOptional({
    enum: TaskListRole,
    description:
      'owner — счётчики по задачам на мои посты; executor — где я исполнитель',
  })
  @IsOptional()
  @IsEnum(TaskListRole)
  role?: TaskListRole;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ограничить счётчики задачами поста',
  })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по исполнителю (executor.id)',
  })
  @IsOptional()
  @IsUUID()
  executorId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по владельцу задачи (owner.id)',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'Начало диапазона (UTC, включительно). Поле задаётся через `dateField` (по умолчанию `finalDate`).',
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
    default: TaskCalendarDateField.FINAL_DATE,
    description:
      'По какому полю фильтровать `dateFrom` / `dateTo`: `createdAt`, `updatedAt` или `finalDate`.',
  })
  @IsOptional()
  @IsEnum(TaskCalendarDateField)
  dateField?: TaskCalendarDateField = TaskCalendarDateField.FINAL_DATE;

  @ApiPropertyOptional({
    description:
      'Только задачи, где текущий аккаунт указан как ответственный (`assigneeAccountId`).',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  assigneeMine?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Фильтр по ответственному: задачи с указанным `assigneeAccountId` (аккаунт менеджера/владельца).',
  })
  @IsOptional()
  @IsUUID()
  assigneeAccountId?: string;
}
