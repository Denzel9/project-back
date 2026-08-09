import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskCommentPinResponseDto {
  @ApiProperty({ format: 'uuid' })
  commentId: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  mediaCount: number;

  @ApiProperty({ format: 'date-time' })
  pinnedAt: string;

  @ApiPropertyOptional({ format: 'uuid' })
  pinnedById?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'uuid' })
  authorId: string;

  @ApiPropertyOptional({ nullable: true })
  actorDisplayName: string | null;

  @ApiPropertyOptional({ enum: ['OWNER', 'MANAGER'], nullable: true })
  actorKind: 'OWNER' | 'MANAGER' | null;
}
