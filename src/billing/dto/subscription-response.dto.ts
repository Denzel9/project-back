import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrimeStatus } from '@prisma/client';

export class SubscriptionResponseDto {
  @ApiProperty({ enum: PrimeStatus })
  status: PrimeStatus;

  @ApiProperty({
    description: 'Активна ли Prime-подписка прямо сейчас у текущего профиля',
  })
  isPrime: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Дата окончания подписки (null — без срока)',
  })
  expiresAt: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Дата активации текущей подписки',
  })
  startedAt: string | null;
}
