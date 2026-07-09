import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform, PublicationStatus } from '@prisma/client';
import { ApplicationOwnerDto } from '../../applications/dto/application-owner.dto';
import { ApplicationApplicantDto } from '../../applications/dto/application-applicant.dto';

export class PublicationMediaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sourceTaskMediaId: string | null;

  @ApiProperty()
  url: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  size: string;

  @ApiProperty()
  mimeType: string;
}

export class PublicationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({ format: 'uuid' })
  postId: string;

  @ApiPropertyOptional({ nullable: true })
  title: string | null;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  externalUrl: string | null;

  @ApiPropertyOptional({ enum: Platform, nullable: true })
  platform: Platform | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  brief: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  deliverables: unknown | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  location: Record<string, unknown> | null;

  @ApiProperty({ enum: PublicationStatus })
  status: PublicationStatus;

  @ApiProperty({ format: 'date-time' })
  publishedAt: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: [PublicationMediaDto] })
  media: PublicationMediaDto[];

  @ApiProperty({ type: ApplicationOwnerDto })
  owner: ApplicationOwnerDto;

  @ApiPropertyOptional({ type: ApplicationApplicantDto, nullable: true })
  executor: ApplicationApplicantDto | null;
}
