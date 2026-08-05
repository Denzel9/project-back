import { ApiProperty } from '@nestjs/swagger';

export class ChatUnreadCountDto {
  @ApiProperty()
  count: number;
}
