import { ApiProperty } from '@nestjs/swagger';
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
}
