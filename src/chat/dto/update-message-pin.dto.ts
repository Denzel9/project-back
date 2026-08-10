import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessagePinScope } from '@prisma/client';
import { IsBoolean, IsEnum, ValidateIf } from 'class-validator';

export class UpdateChatMessagePinDto {
  @ApiProperty({
    description: 'true — закрепить, false — открепить',
  })
  @IsBoolean()
  isPinned: boolean;

  @ApiPropertyOptional({
    enum: MessagePinScope,
    description:
      'Обязателен при isPinned=true. PERSONAL — только для себя, SHARED — для всех участников',
  })
  @ValidateIf(dto => dto.isPinned === true)
  @IsEnum(MessagePinScope)
  scope?: MessagePinScope;
}
