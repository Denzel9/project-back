import { ApiPropertyOptional } from '@nestjs/swagger';
import { UsageRights } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CooperationDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  exclusivity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exclusivityDays?: number;

  @ApiPropertyOptional({ enum: UsageRights })
  @IsOptional()
  @IsEnum(UsageRights)
  usageRights?: UsageRights;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  usageDurationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresMarking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresContract?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  ndaRequired?: boolean;
}
