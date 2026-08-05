import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { transformTrimmedString } from '../../common/query/query-param.transforms';

export class SearchUsersQueryDto {
  @ApiProperty({
    description: 'Поиск по имени/фамилии креатора или названию компании',
    example: 'иван',
    minLength: 2,
  })
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(2)
  q!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
