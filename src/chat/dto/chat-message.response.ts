import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  conversationId: string;

  @ApiProperty({ format: 'uuid' })
  senderId: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Account отправителя (владелец или менеджер)',
  })
  actorAccountId: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Имя актёра на момент отправки (ФИО менеджера или название компании)',
  })
  actorDisplayName: string | null;

  @ApiProperty({
    enum: ['OWNER', 'MANAGER'],
    nullable: true,
    description: 'OWNER — основная компания/креатор; MANAGER — менеджер',
  })
  actorKind: 'OWNER' | 'MANAGER' | null;

  @ApiProperty({ example: 'Hello!' })
  content: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        key: { type: 'string' },
        size: { type: 'string' },
        mimeType: { type: 'string' },
      },
    },
  })
  media: {
    url: string;
    key: string;
    size: string;
    mimeType: string;
  }[];

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description: 'Время последнего редактирования; null — не редактировалось',
  })
  editedAt: Date | null;

  @ApiProperty({
    description: 'Сообщение переслано из другого диалога',
    example: false,
  })
  isRedirected: boolean;

  @ApiProperty({ format: 'uuid', nullable: true })
  redirectedFromUserId: string | null;

  @ApiProperty({ nullable: true })
  redirectedFromDisplayName: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  replyToId: string | null;

  @ApiProperty({ nullable: true })
  replyToPreview: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  replyToSenderId: string | null;

  @ApiProperty({ nullable: true })
  replyToSenderName: string | null;

  @ApiProperty({
    description:
      'Для входящих — прочитано вами; для исходящих — прочитано собеседником',
  })
  isRead: boolean;
}
