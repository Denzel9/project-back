import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class AddFavoriteDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Пост для избранного. Укажите postId или userId',
  })
  @ValidateIf(dto => dto.userId === undefined)
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Креатор или компания для избранного. Укажите postId или userId',
  })
  @ValidateIf(dto => dto.postId === undefined)
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Группа избранного (только для постов). Без поля — сохранить без группы',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
