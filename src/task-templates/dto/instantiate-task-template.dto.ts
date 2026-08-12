import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class InstantiateTaskTemplateDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID поста, для которого создаётся задача',
  })
  @IsUUID()
  postId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'UUID исполнителя (опционально)',
  })
  @IsOptional()
  @IsUUID()
  executorId?: string;
}
