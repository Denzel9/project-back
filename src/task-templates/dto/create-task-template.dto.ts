import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BloggerRequirementsDto } from '../../posts/dto/blogger-requirements.dto';
import { CooperationDetailsDto } from '../../posts/dto/cooperation-details.dto';
import { PostBriefDto } from '../../posts/dto/post-brief.dto';
import { PostDeliverableDto } from '../../posts/dto/post-deliverable.dto';
import { PostLocationDto } from '../../posts/dto/post-location.dto';

export class CreateTaskTemplateDto {
  @ApiProperty({ maxLength: 200, description: 'Название шаблона' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Название задачи', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(500)
  title?: string | null;

  @ApiPropertyOptional({
    maxLength: 5000,
    description: 'Описание задачи в формате Markdown',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoCount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoCount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  finalDate?: string | null;

  @ApiPropertyOptional({ type: PostLocationDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => PostLocationDto)
  location?: PostLocationDto | null;

  @ApiPropertyOptional({ type: BloggerRequirementsDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => BloggerRequirementsDto)
  bloggerRequirements?: BloggerRequirementsDto | null;

  @ApiPropertyOptional({ type: CooperationDetailsDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => CooperationDetailsDto)
  cooperationDetails?: CooperationDetailsDto | null;

  @ApiPropertyOptional({ type: PostBriefDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => PostBriefDto)
  brief?: PostBriefDto | null;

  @ApiPropertyOptional({ type: [PostDeliverableDto], nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostDeliverableDto)
  deliverables?: PostDeliverableDto[] | null;
}
