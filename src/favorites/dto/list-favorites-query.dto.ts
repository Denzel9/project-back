import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { FavoriteListType } from './favorite-list-type.enum';

export class ListFavoritesQueryDto {
  @ApiPropertyOptional({
    enum: FavoriteListType,
    default: FavoriteListType.POST,
    description:
      'Тип избранного: POST (посты, по умолчанию), CREATOR, COMPANY. ' +
      'Для CREATOR/COMPANY фильтры groupId и ungrouped не применяются.',
  })
  @IsOptional()
  @IsEnum(FavoriteListType)
  type?: FavoriteListType = FavoriteListType.POST;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Только избранное в указанной группе',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({
    description: 'Только избранное без группы (не сочетается с groupId)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  ungrouped?: boolean;

  @ApiPropertyOptional({
    description:
      'Поиск: для POST — по названию поста или компании-автора; ' +
      'для CREATOR — по имени/фамилии; для COMPANY — по названию компании',
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
