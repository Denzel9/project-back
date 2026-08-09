import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class HideMessagesDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  messageIds: string[];
}

export class MarkUnreadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  messageId: string;
}

export class ForwardMessageMetaDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  redirectedFromUserId?: string;

  @ApiPropertyOptional()
  redirectedFromDisplayName?: string;
}
