import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'userId собеседника (CREATOR или COMPANY, противоположная ваша роль)',
  })
  @IsUUID()
  recipientId: string;
}
