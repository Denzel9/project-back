import { ApiProperty } from '@nestjs/swagger';

export class ROIResponseDto {
  @ApiProperty({ example: 500, description: 'Стоимость кампании' })
  campaignCost: number;

  @ApiProperty({ example: 750.5, description: 'Оценочная стоимость результата' })
  estimatedValue: number;

  @ApiProperty({ example: 50.1, description: 'ROI в процентах' })
  roi: number;

  @ApiProperty({ example: 0.0417, description: 'Стоимость за вовлечение' })
  cpe: number;

  @ApiProperty({
    description: 'Метрики публикации',
    example: {
      totalEngagement: 1334,
      reach: 12000,
      impressions: 18000,
      engagementRate: 8.5,
    },
  })
  metrics: {
    totalEngagement: number;
    reach: number;
    impressions: number;
    engagementRate: number;
  };
}
