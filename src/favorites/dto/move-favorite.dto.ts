import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class MoveFavoriteDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'UUID группы или null — убрать из группы',
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  groupId?: string | null;
}
