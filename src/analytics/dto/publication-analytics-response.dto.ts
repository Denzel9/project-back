import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '@prisma/client';

export class PublicationAnalyticsResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  publicationId: string;

  @ApiProperty({ enum: Platform })
  platform: Platform;

  @ApiPropertyOptional({ example: 15000 })
  views?: number;

  @ApiPropertyOptional({ example: 1200 })
  likes?: number;

  @ApiPropertyOptional({ example: 45 })
  comments?: number;

  @ApiPropertyOptional({ example: 89 })
  shares?: number;

  @ApiPropertyOptional({ example: 234 })
  saves?: number;

  @ApiPropertyOptional({ example: 12000 })
  reach?: number;

  @ApiPropertyOptional({ example: 18000 })
  impressions?: number;

  @ApiPropertyOptional({ example: 120 })
  followersGain?: number;

  @ApiPropertyOptional({ example: 5 })
  followersLoss?: number;

  @ApiPropertyOptional({ example: 8.5 })
  engagementRate?: number;

  @ApiPropertyOptional({ example: 345 })
  linkClicks?: number;

  @ApiPropertyOptional({ example: 12000 })
  watchTime?: number;

  @ApiPropertyOptional({ example: 45.5 })
  avgWatchTime?: number;

  @ApiPropertyOptional()
  extraMetrics?: Record<string, any>;

  @ApiProperty()
  collectedAt: string;

  @ApiProperty()
  createdAt: string;
}
