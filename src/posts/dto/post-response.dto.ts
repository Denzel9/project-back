import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementFormat,
  Platform,
  PostAuthorType,
  WorkFormat,
} from '@prisma/client';
import { ApplicationOwnerDto } from 'src/applications/dto/application-owner.dto';
import { BloggerRequirementsDto } from './blogger-requirements.dto';
import { CooperationDetailsDto } from './cooperation-details.dto';
import { PostBriefDto } from './post-brief.dto';
import { PostBudgetDto } from './post-budget.dto';
import { PostDeliverableDto } from './post-deliverable.dto';
import { PostLocationDto } from './post-location.dto';
import { PostMediaDto } from './post-media.dto';

export class PostResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Заголовок поста' })
  title: string;

  @ApiProperty({ enum: PostAuthorType, example: PostAuthorType.CREATOR })
  type: PostAuthorType;

  @ApiProperty({ type: [String], example: ['chip1'] })
  chips: string[];

  @ApiProperty({ example: false })
  urgent: boolean;

  @ApiProperty({ type: ApplicationOwnerDto })
  owner: ApplicationOwnerDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: [PostMediaDto] })
  media: PostMediaDto[];

  @ApiProperty({ example: 'Описание поста' })
  description: string;

  @ApiPropertyOptional({ example: false })
  isPrivate?: boolean;

  @ApiProperty({ example: false })
  isArchived: boolean;

  @ApiProperty({ type: [String], example: ['category'] })
  categories: string[];

  @ApiProperty({ type: [String], example: [] })
  permissions: string[];

  @ApiPropertyOptional({ type: [String], example: ['keyword'] })
  keyWords?: string[];

  @ApiPropertyOptional({ enum: Platform, isArray: true })
  platforms?: Platform[];

  @ApiPropertyOptional({ enum: PlacementFormat, isArray: true })
  placementFormats?: PlacementFormat[];

  @ApiPropertyOptional({ type: [String] })
  niche?: string[];

  @ApiPropertyOptional({ type: PostBudgetDto })
  budget?: PostBudgetDto;

  @ApiPropertyOptional({ format: 'date-time' })
  deadline?: string;

  @ApiPropertyOptional({ enum: WorkFormat })
  workFormat?: WorkFormat;

  @ApiPropertyOptional({ type: PostLocationDto })
  location?: PostLocationDto;

  @ApiPropertyOptional({ type: BloggerRequirementsDto })
  bloggerRequirements?: BloggerRequirementsDto;

  @ApiPropertyOptional({ type: CooperationDetailsDto })
  cooperationDetails?: CooperationDetailsDto;

  @ApiPropertyOptional({ type: PostBriefDto })
  brief?: PostBriefDto;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: [PostDeliverableDto] })
  deliverables?: PostDeliverableDto[];
}
