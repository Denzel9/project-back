import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateChatMessageDto {
  @ApiProperty({
    description:
      'Новый текст сообщения. Может быть пустым, если у сообщения есть вложения.',
    maxLength: 10000,
  })
  @IsString()
  @MaxLength(10000)
  content: string;
}
