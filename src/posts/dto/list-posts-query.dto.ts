import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostAuthorType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class ListPostsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по владельцу. Без параметра — все посты, кроме своих',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({
    enum: PostAuthorType,
    description:
      'Фильтр по типу поста. Для чужих постов тип задаётся автоматически по роли (CREATOR видит COMPANY и наоборот)',
  })
  @IsOptional()
  @IsEnum(PostAuthorType)
  type?: PostAuthorType;

  @ApiPropertyOptional({ description: 'Фильтр по архивным постам' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({
    description: 'Поиск по названию поста или названию компании-автора',
    example: 'реклама',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  @MinLength(1)
  q?: string;

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
