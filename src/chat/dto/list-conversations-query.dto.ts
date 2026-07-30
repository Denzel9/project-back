import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { transformTrimmedString } from '../../common/query/query-param.transforms';

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description:
      'Поиск по имени собеседника (creator/company) или тексту сообщений в диалоге',
    example: 'договор',
  })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  q?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по userId собеседника',
  })
  @IsOptional()
  @IsUUID()
  peerId?: string;
}
