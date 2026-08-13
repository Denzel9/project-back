import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementFormat,
  Platform,
  PostAuthorType,
  EmploymentType,
  WorkFormat,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApplicationOwnerDto } from '../../applications/dto/application-owner.dto';
import { BloggerRequirementsDto } from './blogger-requirements.dto';
import { CooperationDetailsDto } from './cooperation-details.dto';
import { PostBriefDto } from './post-brief.dto';
import { PostBudgetDto } from './post-budget.dto';
import { PostDeliverableDto } from './post-deliverable.dto';
import { PostLocationDto } from './post-location.dto';
import { PostMediaDto } from './post-media.dto';

export class CreatePostDto {
  @ApiProperty({ example: 'Заголовок поста' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chips?: string[];

  @ApiPropertyOptional({ example: '', default: '', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyWords?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Сохранить как шаблон объявления. Шаблон не показывается в ленте и в списке объявлений.',
  })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ enum: Platform, isArray: true, default: [] })
  @IsOptional()
  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms?: Platform[];

  @ApiPropertyOptional({ enum: PlacementFormat, isArray: true, default: [] })
  @IsOptional()
  @IsArray()
  @IsEnum(PlacementFormat, { each: true })
  placementFormats?: PlacementFormat[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  niche?: string[];

  @ApiPropertyOptional({ type: PostBudgetDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostBudgetDto)
  budget?: PostBudgetDto;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ enum: WorkFormat })
  @IsOptional()
  @IsEnum(WorkFormat)
  workFormat?: WorkFormat;

  @ApiPropertyOptional({
    enum: EmploymentType,
    nullable: true,
    description: 'Тип занятости: STAFF — в штат, ONE_TIME — разовое сотрудничество',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType | null;

  @ApiPropertyOptional({ type: PostLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostLocationDto)
  location?: PostLocationDto;

  @ApiPropertyOptional({ type: BloggerRequirementsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BloggerRequirementsDto)
  bloggerRequirements?: BloggerRequirementsDto;

  @ApiPropertyOptional({ type: CooperationDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CooperationDetailsDto)
  cooperationDetails?: CooperationDetailsDto;

  @ApiPropertyOptional({ type: PostBriefDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostBriefDto)
  brief?: PostBriefDto;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [PostDeliverableDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostDeliverableDto)
  deliverables?: PostDeliverableDto[];
}
