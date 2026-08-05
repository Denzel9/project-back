import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateConversationDto {
  @ApiProperty({
    description: 'Закрепить или открепить диалог в списке контактов',
  })
  @IsBoolean()
  isPinned: boolean;
}
