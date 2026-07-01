import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { transformTrimmedString } from '../../common/query/query-param.transforms';
import { TaskListRole } from './list-tasks-query.dto';

export class ListTasksWithCommentsQueryDto {
  @ApiPropertyOptional({
    enum: TaskListRole,
    description:
      'owner — задачи на мои посты; executor — где я исполнитель',
  })
  @IsOptional()
  @IsEnum(TaskListRole)
  role?: TaskListRole;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Поиск по тексту последних комментариев, title задачи или поста',
    example: 'договор',
  })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  q?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Метка «прочитано до». Если передана — в ответе будет `unreadCount`: ' +
      'комментарии других участников, созданные позже этой даты.',
  })
  @IsOptional()
  @IsDateString()
  readAfter?: string;

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
