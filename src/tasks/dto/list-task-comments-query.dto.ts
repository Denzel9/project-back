import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { transformOptionalBoolean } from '../../common/query/query-param.transforms';

export class ListTaskCommentsQueryDto {
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

  @ApiPropertyOptional({
    default: true,
    description:
      'Отметить комментарии задачи прочитанными (обновляет lastReadAt). По умолчанию true',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  markRead?: boolean;
}
