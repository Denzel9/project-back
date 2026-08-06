import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateChatMessagePinDto {
  @ApiProperty({
    description: 'true — закрепить, false — открепить',
  })
  @IsBoolean()
  isPinned: boolean;
}

