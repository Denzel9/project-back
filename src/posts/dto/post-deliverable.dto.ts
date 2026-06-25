import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementFormat, Platform } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class PostDeliverableDto {
  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({ enum: PlacementFormat })
  @IsEnum(PlacementFormat)
  format: PlacementFormat;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSec?: number;
}
