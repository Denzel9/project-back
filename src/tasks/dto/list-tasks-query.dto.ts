import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum TaskListRole {
  OWNER = 'owner',
  EXECUTOR = 'executor',
}

export class ListTasksQueryDto {
  @ApiPropertyOptional({
    enum: TaskListRole,
    description: 'owner — задачи на мои посты; executor — задачи где я исполнитель',
  })
  @IsOptional()
  @IsEnum(TaskListRole)
  role?: TaskListRole;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

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
