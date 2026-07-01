import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskActivityType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TaskListRole } from './list-tasks-query.dto';

export class ListAllTaskActivitiesQueryDto {
  @ApiPropertyOptional({ enum: TaskActivityType })
  @IsOptional()
  @IsEnum(TaskActivityType)
  type?: TaskActivityType;

  @ApiPropertyOptional({
    enum: TaskListRole,
    description:
      'owner — активности по задачам на мои посты; executor — где я исполнитель',
  })
  @IsOptional()
  @IsEnum(TaskListRole)
  role?: TaskListRole;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Только активности указанной задачи (если есть доступ)',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string;

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
