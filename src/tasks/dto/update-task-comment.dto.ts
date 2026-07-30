import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateTaskCommentDto {
  @ApiProperty({
    maxLength: 2000,
    description:
      'Новый текст. Может быть пустым, если у комментария есть вложения',
  })
  @IsString()
  @MaxLength(2000)
  content: string;
}
