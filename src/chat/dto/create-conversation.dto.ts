import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'userId собеседника',
  })
  @IsUUID()
  recipientId: string;
}
