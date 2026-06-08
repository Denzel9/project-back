import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class ChatPeerResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Role, example: Role.CREATOR })
  role: Role;

  @ApiProperty({ nullable: true, example: 'https://example.com/avatar.png' })
  avatar: string | null;

  @ApiProperty({ example: 'John Doe' })
  displayName: string;
}
