import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class PartnerSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiPropertyOptional({ nullable: true })
  avatar: string | null;

  @ApiProperty({
    description: 'Профиль проверен платформой (бейдж верификации)',
  })
  isVerified: boolean;

  @ApiPropertyOptional({ description: 'Только для CREATOR' })
  name?: string;

  @ApiPropertyOptional({ description: 'Только для CREATOR' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Только для COMPANY' })
  companyName?: string;

  @ApiProperty({
    description:
      'Число публикаций пользователя (как owner или executor)',
  })
  publicationsCount: number;

  @ApiProperty({
    description: 'Количество связанных задач или откликов с учётом фильтров',
  })
  interactionsCount: number;

  @ApiProperty({
    format: 'date-time',
    description: 'Дата последней связанной задачи или отклика',
  })
  lastInteractionAt: string;
}
