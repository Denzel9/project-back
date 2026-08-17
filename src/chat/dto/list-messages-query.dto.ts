import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { transformOptionalBoolean } from '../../common/query/query-param.transforms';

export class ListMessagesQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Cursor-пагинация вверх: id сообщения, старше которого загружать историю',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Окно вокруг сообщения (для прыжка из поиска/закрепа). Не сочетается с cursor/after',
  })
  @IsOptional()
  @IsUUID()
  around?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Пагинация вниз: id сообщения, новее которого загружать. Не сочетается с cursor/around',
  })
  @IsOptional()
  @IsUUID()
  after?: string;

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
      'Отметить диалог прочитанным. По умолчанию true только для хвоста ленты (без cursor/around/after)',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  markRead?: boolean;
}
