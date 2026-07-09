import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
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
}
