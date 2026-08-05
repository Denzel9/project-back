import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, Role } from '@prisma/client';
import { NotificationPayload } from '../notification-payload.types';

export class NotificationActorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiPropertyOptional({ nullable: true })
  avatar?: string | null;

  @ApiPropertyOptional({ description: 'Для CREATOR' })
  name?: string;

  @ApiPropertyOptional({ description: 'Для CREATOR' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Для COMPANY' })
  companyName?: string;
}

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  body: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload: NotificationPayload;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  readAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiPropertyOptional({ type: NotificationActorDto, nullable: true })
  actor: NotificationActorDto | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Account актёра (владелец или менеджер)',
  })
  actorAccountId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Снимок имени актёра',
  })
  actorDisplayName: string | null;

  @ApiPropertyOptional({
    enum: ['OWNER', 'MANAGER'],
    nullable: true,
  })
  actorKind: 'OWNER' | 'MANAGER' | null;
}

export class NotificationUnreadCountDto {
  @ApiProperty()
  count: number;
}
