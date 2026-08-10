import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';

export class CollectAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Access token для платформы (если требуется)',
    example: 'EAABwzLixnjYBO...',
  })
  @IsOptional()
  accessToken?: string;
}

export class CalculateROIDto {
  @ApiProperty({
    description: 'Стоимость кампании',
    example: 500,
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  campaignCost: number;
}

export class GetAnalyticsHistoryDto {
  @ApiPropertyOptional({
    description: 'Количество записей',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
