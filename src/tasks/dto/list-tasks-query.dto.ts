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
  ValidateIf,
} from 'class-validator';
import {
  transformCsvArray,
  transformOptionalBoolean,
  transformOptionalNullableBoolean,
} from '../../common/query/query-param.transforms';
import { TaskCalendarDateField } from './task-calendar-date-field.enum';

export enum TaskListRole {
  OWNER = 'owner',
  EXECUTOR = 'executor',
}

export enum TaskListPersonField {
  EXECUTOR = 'executor',
  OWNER = 'owner',
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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Фильтр по владельцу задачи (owner.id). С `role=executor` — задачи у указанного заказчика.',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Фильтр по исполнителю (executor.id). С `role=owner` — задачи с указанным исполнителем.',
  })
  @IsOptional()
  @IsUUID()
  executorId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по конкретной задаче (task.id)',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    enum: TaskStatus,
    isArray: true,
    description: 'Несколько статусов через запятую, например `ANNULLED,COMPLETED`',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsEnum(TaskStatus, { each: true })
  statuses?: TaskStatus[];

  @ApiPropertyOptional({
    description:
      'Только активные: исключить `COMPLETED`, `ANNULLED`. Сочетается с `status`/`statuses` (пересечение).',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description:
      'Исключить только `COMPLETED`. Не применяется, если передан `active=true`.',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  excludeCompleted?: boolean;

  @ApiPropertyOptional({
    description: 'Очередь компании (`true`) или исполнителя (`false`).',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isCompanyAction?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Фильтр по одобрению исполнителя: `true`, `false` или `null` (ещё не ответил).',
  })
  @IsOptional()
  @Transform(transformOptionalNullableBoolean)
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  isExecutorApprove?: boolean | null;

  @ApiPropertyOptional({
    description:
      'Только без назначенного исполнителя: `executorId: null` и `isExecutorApprove: null`. Для owner; при `role=executor` — пустой список.',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({
    description: 'Просроченные: `finalDate` раньше текущего момента.',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Только срочные (`urgent: true`).' })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  urgent?: boolean;

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

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дате создания задачи (календарный день, UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'createdDate должен быть в формате YYYY-MM-DD',
  })
  createdDate?: string;

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
    format: 'date',
    description: 'Фильтр по дедлайну задачи (календарный день, UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'deadlineDate должен быть в формате YYYY-MM-DD',
  })
  deadlineDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'Начало диапазона (UTC, включительно). Поле задаётся через `dateField` (по умолчанию `createdAt`). Не сочетается с `createdDate`.',
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
      'По какому полю фильтровать `dateFrom` / `dateTo`: `createdAt`, `updatedAt` или `finalDate`.',
  })
  @IsOptional()
  @IsEnum(TaskCalendarDateField)
  dateField?: TaskCalendarDateField = TaskCalendarDateField.CREATED_AT;

  @ApiPropertyOptional({
    description:
      'Смещение таймзоны клиента в минутах, как у `Date#getTimezoneOffset()` ' +
      '(например, Москва UTC+3 → `-180`). Используется для `createdDate`, ' +
      '`updatedDate`, `deadlineDate`, `dateFrom`/`dateTo`. Без параметра день считается в UTC.',
    example: -180,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  tzOffset?: number;

  @ApiPropertyOptional({
    description:
      'Поиск по названию задачи, названию поста или названию компании-автора',
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
    description:
      'Поиск по связанному человеку: исполнитель (`personField=executor`) или заказчик (`personField=owner`)',
    example: 'иван',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  @MinLength(1)
  personQ?: string;

  @ApiPropertyOptional({
    enum: TaskListPersonField,
    description:
      'Кого искать по `personQ`. По умолчанию: executor при role=owner, иначе owner.',
  })
  @IsOptional()
  @IsEnum(TaskListPersonField)
  personField?: TaskListPersonField;

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
