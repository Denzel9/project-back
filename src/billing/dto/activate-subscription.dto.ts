import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ActivateSubscriptionDto {
  @ApiPropertyOptional({
    description:
      'Срок stub-активации в днях. По умолчанию 365. Передайте 0 для бессрочной.',
    default: 365,
    minimum: 0,
    maximum: 3650,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  days?: number;
}
