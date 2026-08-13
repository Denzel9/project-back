import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class SendFileTemplateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Диалог. Укажите conversationId или taskId',
  })
  @ValidateIf(dto => dto.taskId === undefined)
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Задача. Укажите conversationId или taskId',
  })
  @ValidateIf(dto => dto.conversationId === undefined)
  @IsUUID()
  taskId?: string;
}
