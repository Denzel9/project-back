import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { ApplicationApplicantDto } from '../../applications/dto/application-applicant.dto';
import { ApplicationPostSummaryDto } from '../../applications/dto/application-post-summary.dto';
import { TaskMediaDto } from './task-media.dto';
import { ApplicationOwnerDto } from 'src/applications/dto/application-owner.dto';

export class TaskCommentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({ format: 'uuid' })
  authorId: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  applicationId: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty({ enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ type: [TaskMediaDto] })
  media: TaskMediaDto[];

  @ApiProperty()
  description: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  finalDate: string | null;

  @ApiProperty()
  photoCount: string;

  @ApiProperty()
  videoCount: string;

  @ApiProperty()
  urgent: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiPropertyOptional({ type: [TaskCommentResponseDto] })
  comments?: TaskCommentResponseDto[];

  @ApiPropertyOptional({ type: ApplicationPostSummaryDto })
  post?: ApplicationPostSummaryDto;

  @ApiPropertyOptional({ type: ApplicationApplicantDto })
  executor?: ApplicationApplicantDto;

  @ApiPropertyOptional({ type: ApplicationOwnerDto })
  owner?: ApplicationOwnerDto;
}
