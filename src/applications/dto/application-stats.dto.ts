import { ApiProperty } from '@nestjs/swagger';

export class ApplicationStatsDto {
  @ApiProperty({
    description: 'Входящие отклики на мои посты со статусом NEW (для COMPANY)',
  })
  incomingNew: number;

  @ApiProperty({
    description:
      'Мои отклики со статусом NEW или VIEWED (для CREATOR)',
  })
  mineActive: number;
}
