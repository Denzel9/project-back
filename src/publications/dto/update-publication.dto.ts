import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { transformTrimmedString } from '../../common/query/query-param.transforms';

export class PublicationLinkInputDto {
  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform: Platform;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL ссылки; null или пустая строка удаляет ссылку для платформы',
    example: 'https://instagram.com/p/abc',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value === 'string') return value.trim();
    return value;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUrl()
  url?: string | null;
}

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

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://instagram.com/p/abc',
    description: 'Устаревшее поле; предпочтительно links',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUrl()
  externalUrl?: string | null;

  @ApiPropertyOptional({ enum: Platform, nullable: true })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform | null;

  @ApiPropertyOptional({
    type: [PublicationLinkInputDto],
    description: 'Частичное обновление ссылок по платформам (merge)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicationLinkInputDto)
  links?: PublicationLinkInputDto[];
}
