import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export enum CopyTaskMediaKindDto {
  MAIN = 'main',
  REPORT = 'report',
}

export class CopyTaskMediaToConversationDto {
  @ApiProperty({ description: 'UUID задачи-источника' })
  @IsUUID()
  taskId: string;

  @ApiProperty({ description: 'UUID диалога-назначения' })
  @IsUUID()
  conversationId: string;

  @ApiPropertyOptional({
    enum: CopyTaskMediaKindDto,
    default: CopyTaskMediaKindDto.MAIN,
    description: 'Какие вложения задачи копировать (по умолчанию main / ТЗ)',
  })
  @IsOptional()
  @IsEnum(CopyTaskMediaKindDto)
  kind?: CopyTaskMediaKindDto;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Опционально: конкретные UUID TaskMedia. Если не указано — все медиа выбранного kind',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @Type(() => String)
  mediaIds?: string[];
}
