import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AddFavoriteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  postId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Группа избранного. Без поля — сохранить без группы',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
