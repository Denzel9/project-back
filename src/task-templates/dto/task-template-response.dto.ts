import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloggerRequirementsDto } from '../../posts/dto/blogger-requirements.dto';
import { CooperationDetailsDto } from '../../posts/dto/cooperation-details.dto';
import { PostBriefDto } from '../../posts/dto/post-brief.dto';
import { PostDeliverableDto } from '../../posts/dto/post-deliverable.dto';
import { PostLocationDto } from '../../posts/dto/post-location.dto';

export class TaskTemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  title: string | null;

  @ApiProperty()
  description: string;

  @ApiProperty()
  photoCount: string;

  @ApiProperty()
  videoCount: string;

  @ApiProperty()
  urgent: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  finalDate: string | null;

  @ApiPropertyOptional({ type: PostLocationDto, nullable: true })
  location: PostLocationDto | null;

  @ApiPropertyOptional({ type: BloggerRequirementsDto, nullable: true })
  bloggerRequirements: BloggerRequirementsDto | null;

  @ApiPropertyOptional({ type: CooperationDetailsDto, nullable: true })
  cooperationDetails: CooperationDetailsDto | null;

  @ApiPropertyOptional({ type: PostBriefDto, nullable: true })
  brief: PostBriefDto | null;

  @ApiPropertyOptional({ type: [PostDeliverableDto], nullable: true })
  deliverables: PostDeliverableDto[] | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
