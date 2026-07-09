import { ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { transformTrimmedString } from '../../common/query/query-param.transforms';

export class UpdatePublicationDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MaxLength(500)
  title?: string | null;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ nullable: true, example: 'https://instagram.com/p/abc' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUrl()
  externalUrl?: string | null;

  @ApiPropertyOptional({ enum: Platform, nullable: true })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform | null;
}
