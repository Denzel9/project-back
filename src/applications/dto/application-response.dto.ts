import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { ApplicationApplicantDto } from './application-applicant.dto';
import { ApplicationPostSummaryDto } from './application-post-summary.dto';

export class ApplicationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  postId: string;

  @ApiProperty({ example: 'Готов обсудить сотрудничество' })
  message: string;

  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.NEW })
  status: ApplicationStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiPropertyOptional({ type: ApplicationPostSummaryDto })
  post?: ApplicationPostSummaryDto;

  @ApiPropertyOptional({ type: ApplicationApplicantDto })
  applicant?: ApplicationApplicantDto;
}
