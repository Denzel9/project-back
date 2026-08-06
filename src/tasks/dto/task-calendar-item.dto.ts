import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class TaskCalendarParticipantDto {
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

export class TaskCalendarItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  postId: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty()
  urgent: boolean;

  @ApiProperty({ format: 'date-time', nullable: true })
  finalDate: string | null;

  @ApiProperty({
    nullable: true,
    description: 'title задачи или название поста, если title не задан',
  })
  title: string | null;

  @ApiProperty({ type: TaskCalendarParticipantDto })
  owner: TaskCalendarParticipantDto;

  @ApiPropertyOptional({
    type: TaskCalendarParticipantDto,
    nullable: true,
    description: 'null, если исполнитель ещё не назначен',
  })
  executor: TaskCalendarParticipantDto | null;
}
