import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskActivityType } from '@prisma/client';

export class TaskActivityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({ format: 'uuid' })
  actorId: string;

  @ApiProperty({ enum: TaskActivityType })
  type: TaskActivityType;

  @ApiProperty({
    example: { field: 'status', from: 'PREPARING', to: 'IN_PROGRESS' },
  })
  payload: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  actorAccountId: string | null;

  @ApiPropertyOptional({ nullable: true })
  actorDisplayName: string | null;

  @ApiPropertyOptional({ enum: ['OWNER', 'MANAGER'], nullable: true })
  actorKind: 'OWNER' | 'MANAGER' | null;
}
