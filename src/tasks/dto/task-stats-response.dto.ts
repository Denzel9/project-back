import { ApiProperty } from '@nestjs/swagger';

export class TaskStatsResponseDto {
  @ApiProperty({
    description:
      'Ожидают действия текущего пользователя: owner + `isCompanyAction: true` или executor + `isCompanyAction: false`. Только активные задачи.',
  })
  awaitingAction: number;

  @ApiProperty({
    description:
      'Ожидают подтверждения исполнителя: `isExecutorApprove: null` и `executorId` задан. Только активные задачи.',
  })
  awaitingConfirmation: number;

  @ApiProperty({
    description:
      'Без назначенного исполнителя: `executorId: null` и `isExecutorApprove: null`. Считается только для owner.',
  })
  unassigned: number;

  @ApiProperty({
    description:
      'Просроченные: `finalDate` в прошлом, статус не завершён/отменён.',
  })
  overdue: number;

  @ApiProperty({
    description: 'Срочные (`urgent: true`) среди активных задач.',
  })
  urgent: number;

  @ApiProperty({
    description: 'На проверке (`status: CHECKING`).',
  })
  underReview: number;

  @ApiProperty({
    description: 'Аннулированные: `status` — `ANNULLED`.',
  })
  cancelled: number;
}
