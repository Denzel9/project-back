import { ApiProperty } from '@nestjs/swagger';

export class ApplicantStatisticsDto {
  @ApiProperty({ description: 'Завершённые задачи кандидата (как исполнитель или заказчик)' })
  completedWorks: number;

  @ApiProperty({ description: 'Аннулированные задачи кандидата' })
  cancelledWorks: number;

  @ApiProperty({
    description:
      'Совместно завершённые задачи между кандидатом и владельцем поста',
  })
  sharedCompletedWorks: number;

  @ApiProperty({
    description:
      'Совместные публикации между кандидатом и владельцем поста',
  })
  sharedPublications: number;

  @ApiProperty({ description: 'Сколько пользователей добавили кандидата в избранное' })
  favoritedByCount: number;
}
