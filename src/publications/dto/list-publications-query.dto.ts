import { ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { transformTrimmedString } from '../../common/query/query-param.transforms';
import { PublicationListRole } from './publication-list-role.enum';

export class ListPublicationsQueryDto {
  @ApiPropertyOptional({
    enum: PublicationListRole,
    description:
      'owner — публикации по моим задачам; executor — где я исполнитель',
  })
  @IsOptional()
  @IsEnum(PublicationListRole)
  role?: PublicationListRole;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по владельцу публикации (компания)',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по исполнителю публикации (креатор)',
  })
  @IsOptional()
  @IsUUID()
  executorId?: string;

  @ApiPropertyOptional({ description: 'Поиск по title' })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  q?: string;

  @ApiPropertyOptional({
    description: 'Поиск по имени/фамилии исполнителя',
    example: 'иван',
  })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  executorQ?: string;

  @ApiPropertyOptional({
    enum: Platform,
    description: 'Фильтр по площадке публикации',
  })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
