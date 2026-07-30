import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { transformOptionalBoolean } from '../../common/query/query-param.transforms';

export class ListMessagesQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Cursor-пагинация: id сообщения, старше которого загружать историю',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({
    default: 50,
    minimum: 1,
    maximum: 100,
    description: 'Сколько сообщений вернуть (по умолчанию 50, макс. 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    default: true,
    description:
      'Отметить диалог прочитанным (обновляет lastReadAt). По умолчанию true без cursor, false при cursor',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  markRead?: boolean;
}
