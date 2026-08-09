import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { ApplicantStatisticsDto } from './applicant-statistics.dto';
import { ApplicationApplicantDto } from './application-applicant.dto';
import { ApplicationPostSummaryDto } from './application-post-summary.dto';

export class ApplicationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Готов обсудить сотрудничество' })
  message: string;

  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.NEW })
  status: ApplicationStatus;

  @ApiProperty({
    description: 'Кандидат разрешил показать статистику владельцу поста',
  })
  attachStatistics: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdActorAccountId: string | null;

  @ApiPropertyOptional({ nullable: true })
  createdActorDisplayName: string | null;

  @ApiPropertyOptional({ enum: ['OWNER', 'MANAGER'], nullable: true })
  createdActorKind: 'OWNER' | 'MANAGER' | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  lastActorAccountId: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastActorDisplayName: string | null;

  @ApiPropertyOptional({ enum: ['OWNER', 'MANAGER'], nullable: true })
  lastActorKind: 'OWNER' | 'MANAGER' | null;

  @ApiPropertyOptional({ type: ApplicationPostSummaryDto })
  post?: ApplicationPostSummaryDto;

  @ApiPropertyOptional({ type: ApplicationApplicantDto })
  applicant?: ApplicationApplicantDto;

  @ApiPropertyOptional({
    type: ApplicantStatisticsDto,
    nullable: true,
    description:
      'Статистика кандидата (только если attachStatistics=true и ответ для владельца поста)',
  })
  applicantStatistics?: ApplicantStatisticsDto | null;
}
